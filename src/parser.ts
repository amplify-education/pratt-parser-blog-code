import * as Parselet from './parselet';
import {TokenType} from './lexer';
import {TokenStream} from './tokenstream';
import * as AST from './ast';

export function parse(text: string): {nodes: AST.Node[]; errors: string[]} {
  const nodes: AST.Node[] = [];

  const tokens = new TokenStream(text);
  const parser = new Parser();
  while (tokens.peek()) {
    try {
      nodes.push(parser.parse(tokens, 0));
    } catch (e) {
      return {
        nodes,
        errors: [e.message],
      };
    }
  }

  return {nodes, errors: []};
}

export abstract class AbstractParser {
  public bindingPowers: {[tokenType in TokenType]: number};

  protected abstract initialMap(): Partial<
    {[K in TokenType]: Parselet.InitialParselet}
  >;
  protected abstract consequentMap(): Partial<
    {[K in TokenType]: Parselet.ConsequentParselet}
  >;
  protected abstract bindingClasses(): TokenType[][];

  constructor() {
    this.bindingPowers = {} as any;

    const bindingClasses = this.bindingClasses();
    for (let i = 0; i < bindingClasses.length; i++) {
      for (const tokenType of bindingClasses[i]) {
        this.bindingPowers[tokenType] = 10 * i + 9;
      }
    }

    for (const tokenType of Object.keys(this.consequentMap) as TokenType[]) {
      if (this.bindingPowers[tokenType] == undefined) {
        throw new Error(
          `Token ${tokenType} defined in consequentMap has no associated binding power.
          Make sure it is also listed in bindingClasses.`,
        );
      }
    }
  }

  bindingPower(tokenType: TokenType): number {
    if (this.bindingPowers[tokenType] != undefined) {
      return this.bindingPowers[tokenType];
    } else {
      throw new Error(
        `Tried to parse token type ${tokenType} with a parser that does not have it defined.`,
      );
    }
  }

  parse(tokens: TokenStream, currentBindingPower: number): AST.Node {
    const token = tokens.consume();
    if (!token) {
      throw new Error(
        `Expected a start of an expression but ran out of tokens: ${JSON.stringify(
          tokens.last(),
        )}`,
      );
    }

    const initialParselet = this.initialMap()[token.type];

    if (!initialParselet) {
      throw new Error(
        `Expected a start of an expression but found "${
          token.text
        }": ${JSON.stringify(token)}`,
      );
    }

    let left = initialParselet.parse(this, tokens, token);

    while (true) {
      const next = tokens.peek();
      if (!next) {
        break;
      }

      const consequentParselet = this.consequentMap()[next.type];

      if (!consequentParselet) {
        break;
      }

      if (currentBindingPower >= this.bindingPower(next.type)) {
        break;
      }

      tokens.consume();
      left = consequentParselet.parse(this, tokens, left, next);
    }

    return left;
  }
}

export class Parser extends AbstractParser {
  initialMap() {
    return {
      NUMBER: new Parselet.NumberParselet(),
      '(': new Parselet.ParenParselet(),
    };
  }

  consequentMap() {
    return {
      '+': new Parselet.BinaryOperatorParselet('+', 'left'),
      '-': new Parselet.BinaryOperatorParselet('-', 'left'),
      '*': new Parselet.BinaryOperatorParselet('*', 'left'),
      '/': new Parselet.BinaryOperatorParselet('/', 'left'),
      '^': new Parselet.BinaryOperatorParselet('^', 'right'),
    };
  }

  bindingClasses() {
    const classes: TokenType[][] = [
      ['+', '-'],
      ['*', '/'],
      ['^']
    ];
    return classes;
  }
}
