---
title: "Formal Syntax Scraping With ANTLR"
description:
date: 2023-05-07
tags: ["ANTLR", "Python"]
categories: ["Programming Languages"]
image:
math:
license:
comments: true
draft:
build:
  list: always
---

A few years ago, I discovered [ANTLR](https://www.antlr.org/) while trying to build a parser for a custom config file format. By defining a simple grammar, I was able to get my work done. Then, I discovered the [grammars-v4](https://github.com/antlr/grammars-v4) repository on GitHub and looked at the existing grammars of the languages I knew at the time. I immediately noticed that the **SystemVerilog** grammar was incomplete and the **Verilog** grammar had many commented-out rules for some reason. I decided to contribute by completing these two grammars, and started writing the grammar rules for SystemVerilog by copy-pasting sections from the [specification document](https://ieeexplore.ieee.org/document/8299595) and manually(!) converting the [BNF](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form) syntax to ANTLR's grammar format.

After some serious work, I completed (or so I thought) the SystemVerilog grammar and created a pull request (PR). I received some feedback regarding formatting issues and fixed them all. Finally, my PR got merged into the main branch. Of course, the grammar was not free of bugs. Some of these issues could be attributed to my lack of experience with ANTLR. However, I kept discovering a particular issue even after fixing many instances of it, and it was due to an unforgivable mistake I had made: handwriting the grammar. It was the inconsistency between the grammar I wrote and the formal syntax of the language. Every time I opened them side by side, I noticed a rule that differed from the specification. At this point, I realized that the only way to do the conversion correctly was to automate this process. This is how [Syntax Scraper](https://github.com/msagca/syntax-scraper) came to life.

Since I was dealing with Verilog grammars, which are **IEEE** standards, I was only interested in the formal syntax described using **Backus-Naur Form (BNF)**. In IEEE 1800-2017 (SystemVerilog standard), Annex A (formal syntax section), there is a list of conventions used in describing the formal syntax:

- Keywords and punctuation are in <span style="color:red">**bold-red**</span> text.
- Syntactic categories are named in nonbold text.
- A vertical bar (`|`) separates alternatives.
- Square brackets (`[` `]`) enclose optional items.
- Braces (`{` `}`) enclose items that can be repeated zero or more times.

To be able to distinguish between text that had different styling, I needed a tool that could extract this information from a PDF. After some research, I found [pdfplumber](https://github.com/assets/scriptsvine/pdfplumber), a Python package that does just what I wanted, which also meant that I was going to use Python to develop this tool. Due to some inconsistencies between different copies of the same standard document on the Internet, such as the use of different font families, I had to rely on one thing to detect bold text: the word **bold** appearing in the font name of the character.

After processing the PDF, I needed to parse its text to find the rule definitions. To accomplish this task, I decided to use an ANTLR-generated parser. However, there was an obvious issue: ANTLR cannot directly use font styling information, so I had to insert some special characters into the input text to help ANTLR differentiate between regular and bold text. Therefore, I decided to enclose bold text within single quotes (`'`). Since the input could also contain single quotes, which are literal delimiters in ANTLR syntax, I had to escape them with backslashes (`\`) to avoid syntax errors caused by unmatched single quotes. Similarly, backslashes in the input stream could cause issues, so I had to escape them as well. Below is the part of the BNF lexer grammar I created to handle these strings.

```antlr
APOSTROPHE : "\'" -> skip, pushMode(STRING_MODE) ;
mode STRING_MODE;
STRING_TEXT : ~['\\]+ ;
STRING_ESC_SEQ : "\\' ( '\'' | '\\" ) -> type(STRING_TEXT) ;
STRING_APOSTROPHE : "\'" -> skip, popMode ;
```

The only difference between my BNF parser grammar and the original BNF syntax is the "fuzzy parsing" component. It means that the grammar is defined in such a way that only the necessary information is extracted from the input. The `formal_syntax` parser rule exemplifies this behavior. It detects sequences that conform to `rule_definition` and terminates the current match if a token violates the syntax. It then continues looking for the next `::=` (is defined as) token. As a result, if a rule spans multiple pages, the words in the page footer (or in the next page's header) will cause the rest of the rule to be skipped. Nevertheless, it is guaranteed that no `::=` tokens are skipped, meaning that every `::=` defines a rule.

```antlr
formal_syntax : ( rule_definition | ~"::=" )*? EOF ;
rule_definition : rule_identifier "::=" rule_alternatives ;
```

{{< figure src="formal-syntax.svg" title="Railroad diagram of the rule formal_syntax" >}}

After generating a parse tree, the next step was to convert the BNF rules to ANTLR rules. To accomplish this, I used the visitor generated by ANTLR. In the initialization phase, I created an empty string to store the grammar text and defined a variable to keep track of the current hierarchy level so that only the rule alternatives (separated by `|`) began on a new line. As I visited the nodes of the parse tree, I appended each symbol to the string while performing the following actions:

- Enclosed keyword and punctuation symbols, which corresponded to bold text in the input, in single quotes (`'`).
- Appended a question mark (`?`) to optional items.
- Appended an asterisk (`*`) to repeated (zero or more times) items.
- Enclosed groups of items in parentheses (`(` `)`).

In addition to these, I had to override the default implementations of certain visitor functions, so they would return the text associated with each node:

```python
def visitChildren(self, node):
  text = ""
  n = node.getChildCount()
  for i in range(n):
    if i > 0:
      text += " "
    c = node.getChild(i)
    result = c.accept(self)
    if result == None:
      result = ""
    text += result
  return text

def visitTerminal(self, node):
  return node.getText()
```

The ANTLR grammar generated by my tool is not free of syntax errors. The tool cannot distinguish between the title text, which is in bold, and bold text in rules. Furthermore, there are other text such as footnote references that have no clear styling information to indicate whether they are part of the rule text or not. However, I was able to identify and remove section references by the distinctive character called the section sign (`§`). Additionally, some rules may be incomplete, or even empty, due to their start and end being on different pages. All of these issues must be resolved manually by the user.

Although not perfect, this tool helped me eliminate all the inconsistencies between my grammar and the specification. With the [ANTLR extension](https://marketplace.visualstudio.com/items?itemName=mike-lischke.vscode-antlr4) for Visual Studio Code, I was able to find and fix the syntax errors easily. Since submitting my first PR to the grammars repository, I have improved my grammar design skills and updated my grammars to a higher standard. I occasionally contribute new grammars to the repository and strive to assist other contributors and users.
