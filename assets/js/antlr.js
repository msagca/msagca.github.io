function antlrLanguage(hljs) {
  const RULE_NAME = {
    className: "title.function",
    begin: /^[a-z][a-zA-Z0-9_]*/,
    relevance: 10,
  };
  const TOKEN_NAME = {
    className: "title.class",
    begin: /[A-Z][A-Z0-9_]*/,
    relevance: 8,
  };
  const STRING = {
    className: "string",
    variants: [
      {
        begin: /'/,
        end: /'/,
        contains: [hljs.BACKSLASH_ESCAPE],
      },
      {
        begin: /"/,
        end: /"/,
        contains: [hljs.BACKSLASH_ESCAPE],
      },
    ],
  };
  const ACTION_CODE = {
    className: "section",
    begin: /\{/,
    end: /\}/,
    contains: [
      {
        begin: /\{/,
        end: /\}/,
        contains: ["self"],
      },
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      STRING,
    ],
  };
  const OPTION = {
    className: "meta",
    begin: /options\s*\{/,
    end: /\}/,
    contains: [
      {
        className: "meta-keyword",
        begin: /\b[a-zA-Z_][a-zA-Z0-9_]*\s*=/,
      },
      STRING,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
    ],
  };
  const HEADER = {
    className: "meta",
    begin: /@[a-zA-Z_][a-zA-Z0-9_]*/,
    end: /\{/,
    returnEnd: true,
    contains: [
      {
        className: "meta-keyword",
        begin: /@[a-zA-Z_][a-zA-Z0-9_]*/,
      },
    ],
  };
  const GRAMMAR_TYPE = {
    className: "keyword",
    begin: /\b(grammar|lexer\s+grammar|parser\s+grammar)\b/,
  };
  const KEYWORDS = {
    $pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
    keyword: [
      "grammar",
      "lexer",
      "parser",
      "fragment",
      "import",
      "returns",
      "locals",
      "throws",
      "catch",
      "finally",
      "mode",
      "pushMode",
      "popMode",
      "skip",
      "more",
      "type",
      "channel",
    ].join(" "),
  };
  const OPERATORS = {
    className: "operator",
    begin: /[|*+?~]/,
  };
  const SPECIAL_CHARS = {
    className: "punctuation",
    begin: /[;:()[\]]/,
  };
  const RANGE = {
    className: "string",
    begin: /\[/,
    end: /\]/,
    contains: [
      {
        begin: /\\./,
      },
      {
        begin: /-/,
        className: "operator",
      },
    ],
  };
  const DOT = {
    className: "built_in",
    begin: /\./,
  };
  return {
    name: "ANTLR",
    aliases: ["antlr4", "g4"],
    case_insensitive: false,
    keywords: KEYWORDS,
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      GRAMMAR_TYPE,
      HEADER,
      OPTION,
      ACTION_CODE,
      RULE_NAME,
      TOKEN_NAME,
      STRING,
      RANGE,
      OPERATORS,
      SPECIAL_CHARS,
      DOT,
      {
        className: "punctuation",
        begin: /:/,
      },
      {
        className: "operator",
        begin: /\|/,
      },
      {
        className: "punctuation",
        begin: /;/,
      },
    ],
  };
}
