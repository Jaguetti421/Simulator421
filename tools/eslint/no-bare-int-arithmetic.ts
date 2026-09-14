/**
 * no-bare-int-arithmetic — type-aware ESLint rule for packages/sim.
 *
 * Reports any arithmetic whose operand is a branded integer (`Int`) unless the file is
 * allow-listed (the checkedMath module and its tests). The compiler already rejects
 * `const x: Int = a + b` because the brand is lost; this rule closes the remaining gap:
 * arithmetic on Int consumed as a plain `number` (comparisons of sums, array indices,
 * `number` parameters, template literals).
 *
 * Detection of "branded Int" is configurable because brands differ between codebases:
 *   - brandProperties: property names whose presence on an intersection member marks a brand
 *     (default: ["__brand", "__int", "__kind"]). Any value type is accepted unless brandValues is set.
 *   - brandValues: if non-empty, the brand property's type must be a string literal in this list.
 *   - brandTypeNames: type-alias names treated as branded regardless of structure (default: ["Int"]).
 *   - allowFiles: regexes (tested against the absolute filename) where bare arithmetic is allowed.
 *   - flagBitwise: also report bitwise operators (default true; hashing/PRNG files belong in allowFiles).
 *   - flagComparison: also report relational comparisons (default false — comparing two Ints is fine).
 *
 * Requires typed linting: parserOptions.project (or projectService) must be set.
 *
 * Author: reviewing agent, 13 Sep 2026. Delivered for wiring and testing by the web-track developer.
 */
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type ts from 'typescript';

type Options = [{
  brandProperties?: string[];
  brandValues?: string[];
  brandTypeNames?: string[];
  allowFiles?: string[];
  flagBitwise?: boolean;
  flagComparison?: boolean;
}];
type MessageIds = 'bareArithmetic';

const ARITHMETIC = new Set(['+', '-', '*', '/', '%', '**']);
const BITWISE = new Set(['<<', '>>', '>>>', '&', '|', '^']);
const COMPARISON = new Set(['<', '<=', '>', '>=']);
const COMPOUND = new Set(['+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=']);

const createRule = ESLintUtils.RuleCreator(name => `https://lastclan.local/eslint/${name}`);

export const rule = createRule<Options, MessageIds>({
  name: 'no-bare-int-arithmetic',
  meta: {
    type: 'problem',
    docs: { description: 'Disallow bare arithmetic on branded Int values; use checkedMath.' },
    messages: {
      bareArithmetic:
        'Bare `{{operator}}` on branded Int ({{side}}). Use checkedMath (add/sub/mul/divFloor/divCeil/mulDiv) so the result stays checked and branded.',
    },
    schema: [{
      type: 'object',
      properties: {
        brandProperties: { type: 'array', items: { type: 'string' } },
        brandValues: { type: 'array', items: { type: 'string' } },
        brandTypeNames: { type: 'array', items: { type: 'string' } },
        allowFiles: { type: 'array', items: { type: 'string' } },
        flagBitwise: { type: 'boolean' },
        flagComparison: { type: 'boolean' },
      },
      additionalProperties: false,
    }],
  },
  defaultOptions: [{
    brandProperties: ['__brand', '__int', '__kind'],
    brandValues: [],
    brandTypeNames: ['Int'],
    allowFiles: ['[\\\\/]primitives[\\\\/]checked-?[mM]ath(\\.test)?\\.ts$'],
    flagBitwise: true,
    flagComparison: false,
  }],
  create(context, [opts]) {
    const filename = context.filename ?? (context as unknown as { getFilename(): string }).getFilename();
    const allow = (opts.allowFiles ?? []).map(re => new RegExp(re));
    if (allow.some(re => re.test(filename))) return {};

    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();
    const brandProps = new Set(opts.brandProperties ?? []);
    const brandValues = new Set(opts.brandValues ?? []);
    const brandNames = new Set(opts.brandTypeNames ?? []);

    const seen = new WeakSet<ts.Type>();
    function isBranded(type: ts.Type): boolean {
      if (seen.has(type)) return false; // guard recursive aliases
      seen.add(type);
      try {
        if (type.aliasSymbol && brandNames.has(type.aliasSymbol.getName())) return true;
        if (type.isUnion()) return type.types.some(isBranded);
        if (type.isIntersection()) return type.types.some(isBranded);
        for (const name of brandProps) {
          const prop = type.getProperty(name);
          if (!prop) continue;
          if (brandValues.size === 0) return true;
          const decl = prop.valueDeclaration ?? prop.declarations?.[0];
          if (!decl) return true;
          const pt = checker.getTypeOfSymbolAtLocation(prop, decl);
          if (pt.isStringLiteral() && brandValues.has(pt.value)) return true;
          if (pt.isUnion() && pt.types.some(t => t.isStringLiteral() && brandValues.has(t.value))) return true;
        }
        return false;
      } finally {
        seen.delete(type);
      }
    }
    function nodeIsInt(node: TSESTree.Node): boolean {
      const type = services.getTypeAtLocation(node);
      return isBranded(type);
    }
    function report(node: TSESTree.Node, operator: string, side: string) {
      context.report({ node, messageId: 'bareArithmetic', data: { operator, side } });
    }
    function flaggedBinary(op: string): boolean {
      return ARITHMETIC.has(op) || (opts.flagBitwise !== false && BITWISE.has(op)) || (opts.flagComparison === true && COMPARISON.has(op));
    }

    const listeners: TSESLint.RuleListener = {
      BinaryExpression(node) {
        if (!flaggedBinary(node.operator)) return;
        const l = nodeIsInt(node.left), r = nodeIsInt(node.right);
        if (l || r) report(node, node.operator, l && r ? 'both operands' : l ? 'left operand' : 'right operand');
      },
      AssignmentExpression(node) {
        if (!COMPOUND.has(node.operator)) return;
        if (nodeIsInt(node.left) || nodeIsInt(node.right)) report(node, node.operator, 'compound assignment');
      },
      UnaryExpression(node) {
        if ((node.operator === '-' || node.operator === '+' || (opts.flagBitwise !== false && node.operator === '~')) && nodeIsInt(node.argument))
          report(node, node.operator, 'unary operand');
      },
      UpdateExpression(node) {
        if (nodeIsInt(node.argument)) report(node, node.operator, 'update operand');
      },
    };
    return listeners;
  },
});

export default rule;
export const AST = AST_NODE_TYPES; // re-export for consumers that want node type constants
