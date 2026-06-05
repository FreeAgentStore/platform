// Code Detector — evolved pattern scoring heuristic
// Detects programming language from code snippets using keyword + structural + syntax signals.
// No AI model. Pure JS pattern matching evolved from GitHub corpora.

export interface DetectionResult {
  language: string;       // canonical name: "TypeScript", "Python", etc.
  languageId: string;     // lowercase id: "typescript", "python"
  confidence: number;     // 0-1
  scores: { language: string; id: string; score: number }[];  // top 5
  signals: string[];      // which patterns matched: "const + type annotation", "import from", etc.
  fileExtension: string;  // suggested: ".ts", ".py", etc.
}

// ---------------------------------------------------------------------------
// Pattern definition
// ---------------------------------------------------------------------------

interface Pattern {
  /** Regex or string to match against the code */
  re: RegExp;
  /** Human-readable signal description */
  label: string;
  /** Weight 1-5. 5 = unique identifier, 1 = weak/shared signal */
  weight: number;
}

interface LanguageDef {
  name: string;
  id: string;
  ext: string;
  patterns: Pattern[];
}

function p(re: RegExp, label: string, weight: number): Pattern {
  return { re, label, weight };
}

// ---------------------------------------------------------------------------
// Shebang detection
// ---------------------------------------------------------------------------

const SHEBANG_MAP: Record<string, string> = {
  python: 'python',
  python3: 'python',
  node: 'javascript',
  nodejs: 'javascript',
  deno: 'typescript',
  ruby: 'ruby',
  perl: 'perl',
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  php: 'php',
  lua: 'lua',
  elixir: 'elixir',
  Rscript: 'r',
};

function detectShebang(code: string): string | null {
  const first = code.split('\n')[0];
  if (!first?.startsWith('#!')) return null;
  for (const [key, langId] of Object.entries(SHEBANG_MAP)) {
    if (first.includes(key)) return langId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 30 Language definitions with comprehensive pattern lists
// ---------------------------------------------------------------------------

const LANGUAGES: LanguageDef[] = [
  // -----------------------------------------------------------------------
  // 1. JavaScript
  // -----------------------------------------------------------------------
  {
    name: 'JavaScript', id: 'javascript', ext: '.js',
    patterns: [
      p(/\brequire\s*\(/, 'require(', 4),
      p(/\bmodule\.exports\b/, 'module.exports', 5),
      p(/\bexports\.\w+\s*=/, 'exports.x =', 4),
      p(/\bconsole\.\w+\s*\(/, 'console.log(', 2),
      p(/\bfunction\s+\w+\s*\(/, 'function declaration', 1),
      p(/\bvar\s+\w+/, 'var keyword', 2),
      p(/===|!==/, 'strict equality', 2),
      p(/\bprototype\b/, 'prototype', 3),
      p(/=>\s*\{/, 'arrow function', 1),
      p(/\bconst\s+\w+\s*=/, 'const assignment', 1),
      p(/\blet\s+\w+\s*=/, 'let assignment', 1),
      p(/\bdocument\.\w+/, 'document.*', 2),
      p(/\bwindow\.\w+/, 'window.*', 2),
      p(/\bsetTimeout\s*\(/, 'setTimeout', 1),
      p(/\bPromise\b/, 'Promise', 1),
      p(/\basync\s+function\b/, 'async function', 1),
      p(/\.then\s*\(/, '.then(', 1),
      p(/\bJSON\.(parse|stringify)\b/, 'JSON.*', 1),
      p(/\.addEventListener\s*\(/, '.addEventListener(', 2),
      p(/\.getElementById\s*\(/, '.getElementById(', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 2. TypeScript
  // -----------------------------------------------------------------------
  {
    name: 'TypeScript', id: 'typescript', ext: '.ts',
    patterns: [
      p(/:\s*(string|number|boolean|void|any|never|unknown)\b/, 'type annotation', 4),
      p(/\binterface\s+\w+/, 'interface declaration', 5),
      p(/\btype\s+\w+\s*=/, 'type alias', 5),
      p(/<[A-Z]\w*>/, 'generic <T>', 3),
      p(/\benum\s+\w+/, 'enum declaration', 4),
      p(/\bas\s+(const|string|number|any|unknown)\b/, 'as const/type', 4),
      p(/\breadonly\s+\w+/, 'readonly modifier', 4),
      p(/\bimplements\s+\w+/, 'implements keyword', 4),
      p(/\bdeclare\s+(module|const|function|class|var|let|type|interface|enum|namespace)\b/, 'declare keyword', 5),
      p(/\bnamespace\s+\w+/, 'namespace declaration', 3),
      p(/\bkeyof\s+/, 'keyof operator', 5),
      p(/\btypeof\s+\w+\s*===/, 'typeof guard', 1),
      p(/\bimport\s+.*\s+from\s+['"]/, 'import from', 2),
      p(/\bexport\s+(default|const|function|class|interface|type|enum)\b/, 'export keyword', 2),
      p(/\?:\s*\w+/, 'optional property', 3),
      p(/\bRecord</, 'Record<>', 4),
      p(/\bPartial</, 'Partial<>', 4),
      p(/\bPick</, 'Pick<>', 4),
      p(/\bOmit</, 'Omit<>', 4),
      p(/\bconsole\.\w+\s*\(/, 'console.*', 1),
      p(/\basync\s+/, 'async keyword', 1),
      p(/\bawait\s+/, 'await keyword', 1),
      p(/\bconst\s+\w+\s*=/, 'const assignment', 1),
    ],
  },

  // -----------------------------------------------------------------------
  // 3. C
  // -----------------------------------------------------------------------
  {
    name: 'C', id: 'c', ext: '.c',
    patterns: [
      p(/#include\s*<stdio\.h>/, '#include <stdio.h>', 5),
      p(/#include\s*<stdlib\.h>/, '#include <stdlib.h>', 5),
      p(/#include\s*<string\.h>/, '#include <string.h>', 4),
      p(/#include\s*<math\.h>/, '#include <math.h>', 4),
      p(/#include\s*<unistd\.h>/, '#include <unistd.h>', 4),
      p(/\bprintf\s*\(/, 'printf(', 4),
      p(/\bscanf\s*\(/, 'scanf(', 4),
      p(/\bmalloc\s*\(/, 'malloc(', 4),
      p(/\bfree\s*\(/, 'free(', 2),
      p(/\bcalloc\s*\(/, 'calloc(', 4),
      p(/\brealloc\s*\(/, 'realloc(', 4),
      p(/\btypedef\s+struct\b/, 'typedef struct', 5),
      p(/\bvoid\s*\*/, 'void*', 3),
      p(/\bsizeof\s*\(/, 'sizeof(', 2),
      p(/\bstruct\s+\w+\s*\{/, 'struct { }', 2),
      p(/#define\s+\w+/, '#define', 2),
      p(/#ifndef\s+\w+/, '#ifndef guard', 2),
      p(/\bint\s+main\s*\(/, 'int main(', 3),
      p(/\bFILE\s*\*/, 'FILE*', 4),
      p(/\bchar\s*\*/, 'char*', 2),
      p(/->/, 'arrow operator', 1),
      p(/\bNULL\b/, 'NULL', 2),
      p(/\bfgets\s*\(/, 'fgets(', 4),
      p(/\bfprintf\s*\(/, 'fprintf(', 4),
    ],
  },

  // -----------------------------------------------------------------------
  // 4. C++
  // -----------------------------------------------------------------------
  {
    name: 'C++', id: 'cpp', ext: '.cpp',
    patterns: [
      p(/#include\s*<iostream>/, '#include <iostream>', 5),
      p(/#include\s*<vector>/, '#include <vector>', 5),
      p(/#include\s*<string>/, '#include <string>', 3),
      p(/#include\s*<algorithm>/, '#include <algorithm>', 4),
      p(/#include\s*<map>/, '#include <map>', 4),
      p(/#include\s*<memory>/, '#include <memory>', 4),
      p(/\bstd::/, 'std::', 5),
      p(/\bcout\s*<</, 'cout <<', 5),
      p(/\bcin\s*>>/, 'cin >>', 5),
      p(/\bcerr\s*<</, 'cerr <<', 5),
      p(/\btemplate\s*</, 'template<', 4),
      p(/\bclass\s+\w+\s*(:\s*(public|private|protected)\s+\w+)?\s*\{/, 'class declaration', 2),
      p(/\bvirtual\s+/, 'virtual keyword', 4),
      p(/\bnullptr\b/, 'nullptr', 5),
      p(/\bnamespace\s+\w+/, 'namespace', 2),
      p(/\bauto\s+\w+\s*=/, 'auto type', 2),
      p(/\bconst\s+auto\s*&/, 'const auto&', 3),
      p(/\bnew\s+\w+/, 'new keyword', 1),
      p(/\bdelete\s+/, 'delete keyword', 3),
      p(/\bstd::vector</, 'std::vector<>', 5),
      p(/\bstd::string\b/, 'std::string', 5),
      p(/\bstd::map</, 'std::map<>', 5),
      p(/\bstd::unique_ptr</, 'std::unique_ptr<>', 5),
      p(/\bstd::shared_ptr</, 'std::shared_ptr<>', 5),
      p(/\busing\s+namespace\b/, 'using namespace', 4),
      p(/\bendl\b/, 'endl', 4),
      p(/\boverride\b/, 'override', 2),
      p(/::/, 'scope resolution', 1),
    ],
  },

  // -----------------------------------------------------------------------
  // 5. Java
  // -----------------------------------------------------------------------
  {
    name: 'Java', id: 'java', ext: '.java',
    patterns: [
      p(/\bpublic\s+class\s+\w+/, 'public class', 4),
      p(/\bSystem\.out\.println\s*\(/, 'System.out.println', 5),
      p(/\bSystem\.out\.print\s*\(/, 'System.out.print', 5),
      p(/\bpublic\s+static\s+void\s+main\s*\(/, 'public static void main', 5),
      p(/\b(extends|implements)\s+\w+/, 'extends/implements', 2),
      p(/\b@Override\b/, '@Override', 5),
      p(/\b@SuppressWarnings\b/, '@SuppressWarnings', 5),
      p(/\bnew\s+ArrayList\b/, 'new ArrayList', 5),
      p(/\bnew\s+HashMap\b/, 'new HashMap', 5),
      p(/\bimport\s+java\./, 'import java.*', 5),
      p(/\bpackage\s+[\w.]+;/, 'package declaration', 4),
      p(/\b(private|protected|public)\s+(static\s+)?(\w+)\s+\w+\s*[=(;]/, 'access modifier + type', 2),
      p(/\bthrows\s+\w+/, 'throws keyword', 4),
      p(/\btry\s*\{/, 'try block', 1),
      p(/\bcatch\s*\(\w+\s+\w+\)/, 'catch clause', 2),
      p(/\bfinal\s+\w+\s+\w+/, 'final keyword', 2),
      p(/\binstanceof\s+/, 'instanceof', 2),
      p(/;\s*$/, 'semicolon-terminated', 1),
      p(/\bString\s+\w+/, 'String type', 2),
      p(/\bInteger\b/, 'Integer wrapper', 3),
      p(/\bString\[\]\s*args\b/, 'String[] args', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 6. Kotlin
  // -----------------------------------------------------------------------
  {
    name: 'Kotlin', id: 'kotlin', ext: '.kt',
    patterns: [
      p(/\bfun\s+\w+\s*\(/, 'fun declaration', 4),
      p(/\bval\s+\w+\s*[=:]/, 'val declaration', 3),
      p(/\bvar\s+\w+\s*[=:]/, 'var declaration (Kotlin)', 2),
      p(/\bwhen\s*\(/, 'when expression', 5),
      p(/\bdata\s+class\b/, 'data class', 5),
      p(/\?\.\w+/, 'safe call ?.', 4),
      p(/!!\b/, 'non-null assertion !!', 5),
      p(/\bcompanion\s+object\b/, 'companion object', 5),
      p(/\bsealed\s+class\b/, 'sealed class', 5),
      p(/\bit\s*->/, 'it -> lambda', 3),
      p(/\?\s*:/, 'elvis operator ?:', 3),
      p(/\bobject\s+\w+\s*[:{]/, 'object declaration', 3),
      p(/\bprintln\s*\(/, 'println(', 2),
      p(/\bsuspend\s+fun\b/, 'suspend fun', 5),
      p(/\blambda\b|\{\s*\w+\s*->/, 'lambda { x -> }', 2),
      p(/\bimport\s+kotlin\./, 'import kotlin.*', 5),
      p(/\bimport\s+kotlinx\./, 'import kotlinx.*', 5),
      p(/\boverride\s+fun\b/, 'override fun', 4),
      p(/\blazy\s*\{/, 'lazy { }', 4),
      p(/\blistOf\s*\(/, 'listOf()', 4),
      p(/\bmapOf\s*\(/, 'mapOf()', 4),
    ],
  },

  // -----------------------------------------------------------------------
  // 7. Objective-C
  // -----------------------------------------------------------------------
  {
    name: 'Objective-C', id: 'objectivec', ext: '.m',
    patterns: [
      p(/#import\s+/, '#import', 5),
      p(/@interface\s+\w+/, '@interface', 5),
      p(/@implementation\s+\w+/, '@implementation', 5),
      p(/@property\s*\(/, '@property', 5),
      p(/@synthesize\b/, '@synthesize', 5),
      p(/\[[\w\s]+\s+\w+\]/, '[object method]', 4),
      p(/\bNSString\b/, 'NSString', 5),
      p(/\bNSArray\b/, 'NSArray', 5),
      p(/\bNSDictionary\b/, 'NSDictionary', 5),
      p(/\bNSMutableArray\b/, 'NSMutableArray', 5),
      p(/alloc\]\s*init\]/, 'alloc] init]', 5),
      p(/@selector\s*\(/, '@selector()', 5),
      p(/@"[^"]*"/, '@"string literal"', 4),
      p(/\bNSLog\s*\(/, 'NSLog()', 5),
      p(/@end\b/, '@end', 5),
      p(/@protocol\s+\w+/, '@protocol', 5),
      p(/\bself\.\w+/, 'self.property', 2),
      p(/\b(void|BOOL|NSInteger)\s+/, 'ObjC types', 2),
      p(/-\s*\(\w+\)\s*\w+/, '- (Type)method', 3),
      p(/\+\s*\(\w+\)\s*\w+/, '+ (Type)method', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 8. Swift
  // -----------------------------------------------------------------------
  {
    name: 'Swift', id: 'swift', ext: '.swift',
    patterns: [
      p(/\bimport\s+Foundation\b/, 'import Foundation', 5),
      p(/\bimport\s+UIKit\b/, 'import UIKit', 5),
      p(/\bimport\s+SwiftUI\b/, 'import SwiftUI', 5),
      p(/\bguard\s+let\b/, 'guard let', 5),
      p(/\bif\s+let\b/, 'if let', 4),
      p(/\bfunc\s+\w+\s*\(.*\)\s*->\s*\w+/, 'func -> ReturnType', 3),
      p(/\bstruct\s+\w+\s*[:{]/, 'struct declaration', 2),
      p(/\bprotocol\s+\w+/, 'protocol declaration', 3),
      p(/\bextension\s+\w+/, 'extension keyword', 4),
      p(/@State\s+/, '@State property', 5),
      p(/@Binding\s+/, '@Binding property', 5),
      p(/@Published\s+/, '@Published property', 5),
      p(/@ObservedObject\b/, '@ObservedObject', 5),
      p(/\bsome\s+View\b/, 'some View', 5),
      p(/\bvar\s+body\s*:\s*some\s+View/, 'var body: some View', 5),
      p(/\blet\s+\w+\s*[=:]/, 'let declaration', 2),
      p(/\bvar\s+\w+\s*[=:]/, 'var declaration', 1),
      p(/\bprint\s*\(/, 'print()', 1),
      p(/\bnil\b/, 'nil keyword', 2),
      p(/\?\?/, 'nil coalescing ??', 2),
      p(/\boptional\b|\w+\?\s*\./, 'optional chaining', 2),
      p(/\btypealias\b/, 'typealias', 4),
      p(/\bclass\s+\w+\s*:\s*\w+/, 'class inheritance', 2),
    ],
  },

  // -----------------------------------------------------------------------
  // 9. Python
  // -----------------------------------------------------------------------
  {
    name: 'Python', id: 'python', ext: '.py',
    patterns: [
      p(/\bdef\s+\w+\s*\(/, 'def function', 3),
      p(/\bimport\s+\w+/, 'import module', 1),
      p(/\bfrom\s+\w+\s+import\b/, 'from ... import', 3),
      p(/\bif\s+__name__\s*==\s*['"]__main__['"]/, "if __name__ == '__main__'", 5),
      p(/\bself\.\w+/, 'self.attribute', 3),
      p(/\belif\b/, 'elif keyword', 5),
      p(/\bprint\s*\(/, 'print()', 1),
      p(/\bclass\s+\w+\s*(\(.*\))?\s*:/, 'class Foo:', 3),
      p(/^\s{4}/, 'indentation-based (4 spaces)', 1),
      p(/#\s.*$/, '# comment', 1),
      p(/"""[\s\S]*?"""/, '"""docstring"""', 4),
      p(/'''[\s\S]*?'''/, "'''docstring'''", 4),
      p(/f"[^"]*\{/, 'f-string', 5),
      p(/f'[^']*\{/, 'f-string', 5),
      p(/\blambda\s+\w+\s*:/, 'lambda', 3),
      p(/\byield\b/, 'yield keyword', 2),
      p(/@\w+\s*(\(.*\))?\s*\n/, '@decorator', 2),
      p(/\bNone\b/, 'None', 2),
      p(/\bTrue\b/, 'True (capitalized)', 2),
      p(/\bFalse\b/, 'False (capitalized)', 2),
      p(/\braise\s+\w+/, 'raise exception', 3),
      p(/\bexcept\s+\w+/, 'except clause', 3),
      p(/\bwith\s+\w+.*\bas\b/, 'with ... as', 3),
      p(/\bfor\s+\w+\s+in\s+/, 'for x in', 2),
      p(/\blist\s*\(/, 'list()', 1),
      p(/\bdict\s*\(/, 'dict()', 2),
      p(/\blen\s*\(/, 'len()', 2),
      p(/\brange\s*\(/, 'range()', 2),
      p(/->\s*(str|int|float|bool|None|list|dict)\b/, '-> type hint', 4),
    ],
  },

  // -----------------------------------------------------------------------
  // 10. Rust
  // -----------------------------------------------------------------------
  {
    name: 'Rust', id: 'rust', ext: '.rs',
    patterns: [
      p(/\bfn\s+\w+\s*\(/, 'fn declaration', 3),
      p(/\blet\s+mut\s+/, 'let mut', 5),
      p(/\bimpl\s+\w+/, 'impl block', 5),
      p(/\bpub\s+fn\b/, 'pub fn', 4),
      p(/\b->\s*\w+/, '-> return type', 2),
      p(/\bmatch\s+\w+/, 'match expression', 2),
      p(/\benum\s+\w+/, 'enum declaration', 2),
      p(/\bstruct\s+\w+/, 'struct declaration', 2),
      p(/&str\b/, '&str', 5),
      p(/&mut\s+/, '&mut', 5),
      p(/\bVec</, 'Vec<>', 5),
      p(/\bOption</, 'Option<>', 4),
      p(/\bResult</, 'Result<>', 4),
      p(/\.unwrap\(\)/, '.unwrap()', 5),
      p(/::new\(\)/, '::new()', 4),
      p(/#\[derive\(/, '#[derive()]', 5),
      p(/\bmod\s+\w+/, 'mod keyword', 4),
      p(/\buse\s+\w+(::\w+)+/, 'use path::to', 3),
      p(/\btrait\s+\w+/, 'trait declaration', 4),
      p(/\bcargo\b/, 'cargo', 2),
      p(/'[a-z]\b/, "lifetime 'a", 5),
      p(/\bprintln!\s*\(/, 'println!() macro', 5),
      p(/\bformat!\s*\(/, 'format!() macro', 5),
      p(/\bpanic!\s*\(/, 'panic!() macro', 4),
      p(/\bSome\s*\(/, 'Some()', 3),
      p(/\bNone\b/, 'None (Rust)', 1),
      p(/\bOk\s*\(/, 'Ok()', 3),
      p(/\bErr\s*\(/, 'Err()', 3),
      p(/\busize\b/, 'usize type', 5),
      p(/\bi32\b/, 'i32 type', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 11. Go
  // -----------------------------------------------------------------------
  {
    name: 'Go', id: 'go', ext: '.go',
    patterns: [
      p(/\bfunc\s+\w+\s*\(/, 'func declaration', 2),
      p(/\bpackage\s+\w+/, 'package declaration', 4),
      p(/\bimport\s+\(/, 'import block', 3),
      p(/\bimport\s+"[^"]+"/, 'import "pkg"', 3),
      p(/:=/, ':= short variable', 5),
      p(/\bgo\s+func\b/, 'go func (goroutine)', 5),
      p(/\bchan\s+\w+/, 'chan type', 5),
      p(/\bdefer\s+/, 'defer keyword', 5),
      p(/\binterface\s*\{\}/, 'interface{}', 4),
      p(/\bfmt\.\w+/, 'fmt.*', 5),
      p(/\berr\s*!=\s*nil\b/, 'err != nil', 5),
      p(/\bfunc\s+main\s*\(\)/, 'func main()', 4),
      p(/\brange\s+\w+/, 'range keyword', 3),
      p(/\bmake\s*\(/, 'make()', 3),
      p(/\bpanic\s*\(/, 'panic()', 2),
      p(/\bswitch\s+/, 'switch', 1),
      p(/\bstruct\s*\{/, 'struct { }', 2),
      p(/\bnil\b/, 'nil', 1),
      p(/\bfunc\s*\(\s*\w+\s+\*?\w+\)\s+\w+/, 'method receiver', 5),
      p(/\bmap\[\w+\]\w+/, 'map[K]V', 5),
      p(/\bif\s+\w+\s*:=/, 'if x := (init stmt)', 5),
      p(/\btype\s+\w+\s+struct\b/, 'type X struct', 5),
      p(/\btype\s+\w+\s+interface\b/, 'type X interface', 5),
      p(/\bos\.\w+/, 'os.*', 2),
      p(/\blog\.\w+/, 'log.*', 1),
    ],
  },

  // -----------------------------------------------------------------------
  // 12. Ruby
  // -----------------------------------------------------------------------
  {
    name: 'Ruby', id: 'ruby', ext: '.rb',
    patterns: [
      p(/\bdef\s+\w+/, 'def method', 2),
      p(/\bend\b/, 'end keyword', 1),
      p(/\bputs\s+/, 'puts', 4),
      p(/\bdo\s*\|.*\|/, 'do |block|', 5),
      p(/\brequire\s+['"]/, "require 'gem'", 3),
      p(/\brequire_relative\b/, 'require_relative', 5),
      p(/\battr_accessor\b/, 'attr_accessor', 5),
      p(/\battr_reader\b/, 'attr_reader', 5),
      p(/\battr_writer\b/, 'attr_writer', 5),
      p(/\bclass\s+\w+\s*<\s*\w+/, 'class < Parent', 3),
      p(/@\w+\s*=/, '@instance_var =', 3),
      p(/@@\w+/, '@@class_var', 5),
      p(/\bmodule\s+\w+/, 'module declaration', 3),
      p(/\.each\s*(do|\{)/, '.each do', 4),
      p(/\.map\s*(do|\{)/, '.map do', 2),
      p(/\bunless\b/, 'unless keyword', 5),
      p(/\bnil\b/, 'nil', 1),
      p(/\byield\b/, 'yield', 2),
      p(/\bgem\b/, 'gem', 2),
      p(/\bGemfile\b/, 'Gemfile', 4),
      p(/\bsymbol\b|:\w+/, ':symbol', 2),
      p(/\bRails\b/, 'Rails', 3),
      p(/\bp\s+/, 'p (print inspect)', 2),
      p(/\b\.freeze\b/, '.freeze', 4),
      p(/\brescue\b/, 'rescue keyword', 4),
    ],
  },

  // -----------------------------------------------------------------------
  // 13. PHP
  // -----------------------------------------------------------------------
  {
    name: 'PHP', id: 'php', ext: '.php',
    patterns: [
      p(/<\?php\b/, '<?php', 5),
      p(/\$\w+\s*=/, '$variable =', 4),
      p(/\$this->\w+/, '$this->property', 5),
      p(/\becho\s+/, 'echo keyword', 3),
      p(/\bfunction\s+\w+\s*\(/, 'function declaration', 1),
      p(/\bnamespace\s+[\w\\]+;/, 'namespace declaration', 3),
      p(/\buse\s+[\w\\]+;/, 'use statement', 2),
      p(/\bpublic\s+function\b/, 'public function', 3),
      p(/->\w+\s*\(/, '->method()', 2),
      p(/\barray\s*\(/, 'array()', 3),
      p(/\brequire_once\b/, 'require_once', 4),
      p(/\binclude\b/, 'include', 2),
      p(/\bforeach\s*\(.*\bas\b/, 'foreach ... as', 4),
      p(/\bnull\b/, 'null', 1),
      p(/\b(true|false)\b/, 'true/false', 1),
      p(/\.\s*\$\w+/, '. $concat', 3),
      p(/@\w+/, '@ error suppression', 1),
      p(/\bclass\s+\w+\s*(extends|implements)\b/, 'class extends/implements', 2),
      p(/\bstatic\s+function\b/, 'static function', 2),
      p(/\$_GET\b|\$_POST\b|\$_SERVER\b/, '$_GET/$_POST/$_SERVER', 5),
      p(/::\w+\s*\(/, '::static_method()', 2),
    ],
  },

  // -----------------------------------------------------------------------
  // 14. C#
  // -----------------------------------------------------------------------
  {
    name: 'C#', id: 'csharp', ext: '.cs',
    patterns: [
      p(/\busing\s+System\b/, 'using System', 5),
      p(/\bnamespace\s+\w+/, 'namespace declaration', 2),
      p(/\bpublic\s+class\s+\w+/, 'public class', 2),
      p(/\bstatic\s+void\s+Main\s*\(/, 'static void Main()', 5),
      p(/\bConsole\.Write(Line)?\s*\(/, 'Console.WriteLine()', 5),
      p(/\bvar\s+\w+\s*=/, 'var keyword', 1),
      p(/\basync\s+Task\b/, 'async Task', 4),
      p(/\bIEnumerable\b/, 'IEnumerable', 5),
      p(/\bList</, 'List<>', 2),
      p(/\bDictionary</, 'Dictionary<>', 3),
      p(/\b\[Attribute\]|\[\w+\]\s*\n/, '[Attribute]', 2),
      p(/\bget\s*;\s*set\s*;/, 'get; set;', 5),
      p(/\bstring\s+\w+/, 'string type', 1),
      p(/\bint\s+\w+/, 'int type', 1),
      p(/\bLINQ\b|\.Select\s*\(|\.Where\s*\(/, 'LINQ methods', 4),
      p(/\bawait\s+/, 'await keyword', 1),
      p(/\b\.NET\b/, '.NET reference', 3),
      p(/\busing\s*\(/, 'using block', 3),
      p(/\bnew\s+\w+\s*\(/, 'new Object()', 1),
      p(/\boverride\s+(void|string|int|bool|Task)\b/, 'override keyword', 2),
      p(/\bsealed\s+class\b/, 'sealed class', 3),
      p(/\bpartial\s+class\b/, 'partial class', 5),
      p(/=>\s*\w+/, 'expression body =>', 1),
      p(/\?\?\s*=/, '??= null coalesce assign', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 15. Shell/Bash
  // -----------------------------------------------------------------------
  {
    name: 'Shell', id: 'shell', ext: '.sh',
    patterns: [
      p(/^#!\/bin\/(ba)?sh/, '#!/bin/bash', 5),
      p(/\becho\s+/, 'echo', 3),
      p(/\bif\s+\[\s*/, 'if [ test ]', 5),
      p(/\bfi\b/, 'fi (end if)', 5),
      p(/\bthen\b/, 'then keyword', 3),
      p(/\belif\b/, 'elif (shell)', 2),
      p(/\$\w+/, '$VARIABLE', 2),
      p(/\$\{\w+\}/, '${variable}', 3),
      p(/"\$\(.*\)"/, '"$(command)"', 4),
      p(/\|\s*\w+/, 'pipe |', 2),
      p(/\bgrep\b/, 'grep', 3),
      p(/\bawk\b/, 'awk', 3),
      p(/\bsed\b/, 'sed', 3),
      p(/\bexport\s+\w+/, 'export VAR', 4),
      p(/\bsource\s+/, 'source', 4),
      p(/\bfor\s+\w+\s+in\b/, 'for x in', 2),
      p(/\bdone\b/, 'done keyword', 3),
      p(/\bwhile\s+/, 'while loop', 1),
      p(/\bcase\s+.*\bin\b/, 'case ... in', 3),
      p(/\besac\b/, 'esac', 5),
      p(/\bchmod\b/, 'chmod', 3),
      p(/\bmkdir\b/, 'mkdir', 2),
      p(/\bcd\s+/, 'cd command', 2),
      p(/\bfunction\s+\w+\s*\(\)/, 'function declaration', 2),
      p(/\[\[\s+.*\s+\]\]/, '[[ test ]]', 4),
      p(/\bset\s+-[euxo]/, 'set -e/-u/-x', 5),
      p(/\bexit\s+\d+/, 'exit code', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 16. SQL
  // -----------------------------------------------------------------------
  {
    name: 'SQL', id: 'sql', ext: '.sql',
    patterns: [
      p(/\bSELECT\b/i, 'SELECT', 3),
      p(/\bFROM\b/i, 'FROM', 2),
      p(/\bWHERE\b/i, 'WHERE', 2),
      p(/\bINSERT\s+INTO\b/i, 'INSERT INTO', 5),
      p(/\bCREATE\s+TABLE\b/i, 'CREATE TABLE', 5),
      p(/\bALTER\s+TABLE\b/i, 'ALTER TABLE', 5),
      p(/\bDROP\s+TABLE\b/i, 'DROP TABLE', 5),
      p(/\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\b/i, 'JOIN', 5),
      p(/\bGROUP\s+BY\b/i, 'GROUP BY', 5),
      p(/\bORDER\s+BY\b/i, 'ORDER BY', 4),
      p(/\bHAVING\b/i, 'HAVING', 4),
      p(/\bCREATE\s+INDEX\b/i, 'CREATE INDEX', 5),
      p(/\bPRIMARY\s+KEY\b/i, 'PRIMARY KEY', 5),
      p(/\bFOREIGN\s+KEY\b/i, 'FOREIGN KEY', 5),
      p(/\bVARCHAR\b/i, 'VARCHAR', 5),
      p(/\bINTEGER\b/i, 'INTEGER', 2),
      p(/\bNOT\s+NULL\b/i, 'NOT NULL', 4),
      p(/\bDEFAULT\b/i, 'DEFAULT', 2),
      p(/\bUPDATE\s+\w+\s+SET\b/i, 'UPDATE ... SET', 5),
      p(/\bDELETE\s+FROM\b/i, 'DELETE FROM', 5),
      p(/\bCOUNT\s*\(/, 'COUNT()', 3),
      p(/\bSUM\s*\(/, 'SUM()', 3),
      p(/\bAVG\s*\(/, 'AVG()', 3),
      p(/\bDISTINCT\b/i, 'DISTINCT', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 17. HTML
  // -----------------------------------------------------------------------
  {
    name: 'HTML', id: 'html', ext: '.html',
    patterns: [
      p(/<!DOCTYPE\s+html>/i, '<!DOCTYPE html>', 5),
      p(/<html[\s>]/, '<html>', 5),
      p(/<head[\s>]/, '<head>', 4),
      p(/<body[\s>]/, '<body>', 4),
      p(/<div[\s>]/, '<div>', 3),
      p(/<span[\s>]/, '<span>', 2),
      p(/<a\s+href\s*=/, '<a href="">', 3),
      p(/<img[\s>]/, '<img>', 2),
      p(/\bclass="[^"]*"/, 'class="..."', 3),
      p(/\bid="[^"]*"/, 'id="..."', 2),
      p(/<\/\w+>/, '</closing tag>', 3),
      p(/<meta[\s>]/, '<meta>', 3),
      p(/<link[\s>]/, '<link>', 2),
      p(/<script[\s>]/, '<script>', 2),
      p(/<style[\s>]/, '<style>', 2),
      p(/<form[\s>]/, '<form>', 2),
      p(/<input[\s>]/, '<input>', 2),
      p(/<button[\s>]/, '<button>', 2),
      p(/<table[\s>]/, '<table>', 2),
      p(/<p[\s>]/, '<p>', 1),
      p(/<h[1-6][\s>]/, '<h1-h6>', 2),
      p(/<br\s*\/?>/, '<br>', 2),
      p(/<!--/, '<!-- comment -->', 2),
    ],
  },

  // -----------------------------------------------------------------------
  // 18. CSS
  // -----------------------------------------------------------------------
  {
    name: 'CSS', id: 'css', ext: '.css',
    patterns: [
      p(/\{[^}]*\b(color|background|margin|padding|display|font|border|width|height)\s*:/, 'CSS property: value', 4),
      p(/@media\s*\(/, '@media query', 5),
      p(/@keyframes\s+\w+/, '@keyframes', 5),
      p(/@import\s+/, '@import', 2),
      p(/\.\w+\s*\{/, '.class { }', 3),
      p(/#\w+\s*\{/, '#id { }', 3),
      p(/:\s*(hover|focus|active|first-child|last-child|nth-child)\b/, ':pseudo-class', 4),
      p(/::(before|after|placeholder|selection)\b/, '::pseudo-element', 4),
      p(/\b(px|rem|em|vh|vw|%)\s*;/, 'CSS units', 3),
      p(/\b(flex|grid|block|inline|none)\s*;/, 'display values', 3),
      p(/\bvar\(--\w+\)/, 'var(--custom-prop)', 5),
      p(/--\w+\s*:/, '--custom-property:', 4),
      p(/\btransition\s*:/, 'transition:', 3),
      p(/\btransform\s*:/, 'transform:', 3),
      p(/\bposition\s*:\s*(relative|absolute|fixed|sticky)/, 'position:', 3),
      p(/\bz-index\s*:/, 'z-index:', 3),
      p(/\bbox-shadow\s*:/, 'box-shadow:', 3),
      p(/\bborder-radius\s*:/, 'border-radius:', 3),
      p(/\bopacity\s*:/, 'opacity:', 2),
      p(/\boverflow\s*:/, 'overflow:', 2),
    ],
  },

  // -----------------------------------------------------------------------
  // 19. Lua
  // -----------------------------------------------------------------------
  {
    name: 'Lua', id: 'lua', ext: '.lua',
    patterns: [
      p(/\bfunction\s*\w*\s*\(.*\)/, 'function declaration', 1),
      p(/\bend\b/, 'end keyword', 1),
      p(/\blocal\s+\w+/, 'local variable', 5),
      p(/\bthen\b/, 'then keyword', 2),
      p(/\belseif\b/, 'elseif keyword', 5),
      p(/\brequire\s*\(?\s*['"]/, "require 'module'", 2),
      p(/\bnil\b/, 'nil', 1),
      p(/\btable\.\w+/, 'table.*', 5),
      p(/\bipairs\s*\(/, 'ipairs()', 5),
      p(/\bpairs\s*\(/, 'pairs()', 5),
      p(/--[^\[]/, '-- comment', 2),
      p(/--\[\[/, '--[[ long comment', 4),
      p(/\.\./, '.. concatenation', 3),
      p(/\bprint\s*\(/, 'print()', 1),
      p(/\btostring\s*\(/, 'tostring()', 4),
      p(/\btonumber\s*\(/, 'tonumber()', 4),
      p(/\bsetmetatable\s*\(/, 'setmetatable()', 5),
      p(/\bgetmetatable\s*\(/, 'getmetatable()', 5),
      p(/\bpcall\s*\(/, 'pcall()', 4),
      p(/#\w+/, '#length operator', 2),
      p(/\brepeat\b/, 'repeat keyword', 3),
      p(/\buntil\b/, 'until keyword', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 20. Dart
  // -----------------------------------------------------------------------
  {
    name: 'Dart', id: 'dart', ext: '.dart',
    patterns: [
      p(/\bvoid\s+main\s*\(\)/, 'void main()', 2),
      p(/\bWidget\b/, 'Widget type', 5),
      p(/\b@override\b/, '@override', 2),
      p(/\bfinal\s+\w+/, 'final keyword', 2),
      p(/\blate\s+\w+/, 'late keyword', 5),
      p(/\bvar\s+\w+/, 'var keyword', 1),
      p(/\bString\s+\w+/, 'String type', 1),
      p(/\bint\s+\w+/, 'int type', 1),
      p(/\bdouble\s+\w+/, 'double type', 1),
      p(/\bclass\s+\w+\s+extends\s+\w+/, 'class extends', 2),
      p(/\bimport\s+'package:/, "import 'package:*'", 5),
      p(/\bFuture</, 'Future<>', 4),
      p(/\basync\b/, 'async keyword', 1),
      p(/\bawait\b/, 'await keyword', 1),
      p(/\bStatelessWidget\b/, 'StatelessWidget', 5),
      p(/\bStatefulWidget\b/, 'StatefulWidget', 5),
      p(/\bBuildContext\b/, 'BuildContext', 5),
      p(/\bScaffold\b/, 'Scaffold', 5),
      p(/\bContainer\b/, 'Container', 2),
      p(/\bEdgeInsets\b/, 'EdgeInsets', 5),
      p(/\bsetState\s*\(/, 'setState()', 4),
      p(/\bconst\s+\w+\s*\(/, 'const constructor', 2),
      p(/\brequired\s+this\./, 'required this.', 5),
      p(/\bprint\s*\(/, 'print()', 1),
    ],
  },

  // -----------------------------------------------------------------------
  // 21. Scala
  // -----------------------------------------------------------------------
  {
    name: 'Scala', id: 'scala', ext: '.scala',
    patterns: [
      p(/\bdef\s+\w+\s*(\[.*\])?\s*\(/, 'def method', 2),
      p(/\bval\s+\w+\s*[=:]/, 'val declaration', 2),
      p(/\bvar\s+\w+\s*[=:]/, 'var declaration', 1),
      p(/\bobject\s+\w+/, 'object declaration', 3),
      p(/\btrait\s+\w+/, 'trait declaration', 4),
      p(/\bcase\s+class\b/, 'case class', 5),
      p(/\bmatch\s*\{/, 'match { }', 3),
      p(/\b=>\s*/, '=> (match arm)', 1),
      p(/\bUnit\b/, 'Unit type', 5),
      p(/\bOption\[/, 'Option[]', 4),
      p(/\bSome\s*\(/, 'Some()', 2),
      p(/\bNone\b/, 'None', 1),
      p(/\bimplicit\b/, 'implicit keyword', 5),
      p(/\bfor\s*\{[^}]*yield\b/, 'for { ... yield }', 5),
      p(/\bimport\s+scala\./, 'import scala.*', 5),
      p(/\bpackage\s+\w+/, 'package declaration', 2),
      p(/\bextends\s+\w+/, 'extends keyword', 1),
      p(/\bwith\s+\w+/, 'with (mixin)', 2),
      p(/\bprintln\s*\(/, 'println()', 1),
      p(/\boverride\s+def\b/, 'override def', 3),
      p(/\bsealed\s+trait\b/, 'sealed trait', 5),
      p(/\bAbstractClass\b|\babstract\s+class\b/, 'abstract class', 2),
      p(/\blazy\s+val\b/, 'lazy val', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 22. R
  // -----------------------------------------------------------------------
  {
    name: 'R', id: 'r', ext: '.R',
    patterns: [
      p(/<-\s*/, '<- assignment', 5),
      p(/\bfunction\s*\(/, 'function()', 1),
      p(/\blibrary\s*\(/, 'library()', 5),
      p(/\bdata\.frame\s*\(/, 'data.frame()', 5),
      p(/\bc\s*\(/, 'c() vector', 3),
      p(/\bggplot\s*\(/, 'ggplot()', 5),
      p(/%>%/, '%>% pipe', 5),
      p(/\$\w+/, '$column access', 2),
      p(/\bNA\b/, 'NA value', 4),
      p(/\bTRUE\b/, 'TRUE (R)', 2),
      p(/\bFALSE\b/, 'FALSE (R)', 2),
      p(/\binstall\.packages\s*\(/, 'install.packages()', 5),
      p(/\bsummary\s*\(/, 'summary()', 3),
      p(/\bplot\s*\(/, 'plot()', 2),
      p(/\bprint\s*\(/, 'print()', 1),
      p(/\bif\s*\(/, 'if ()', 1),
      p(/\bfor\s*\(\s*\w+\s+in\s+/, 'for (x in)', 2),
      p(/\bnrow\s*\(/, 'nrow()', 5),
      p(/\bncol\s*\(/, 'ncol()', 5),
      p(/\bhead\s*\(/, 'head()', 2),
      p(/\bmutate\s*\(/, 'mutate()', 4),
      p(/\bfilter\s*\(/, 'filter()', 1),
      p(/\baes\s*\(/, 'aes()', 5),
      p(/\bgeom_\w+\s*\(/, 'geom_*()', 5),
      p(/\btibble\s*\(/, 'tibble()', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 23. Haskell
  // -----------------------------------------------------------------------
  {
    name: 'Haskell', id: 'haskell', ext: '.hs',
    patterns: [
      p(/\bmodule\s+\w+/, 'module declaration', 2),
      p(/\bimport\s+(qualified\s+)?\w+/, 'import module', 1),
      p(/\bdata\s+\w+\s*=/, 'data type', 4),
      p(/\btype\s+\w+\s*=/, 'type alias', 2),
      p(/\bclass\s+\w+.*\bwhere\b/, 'typeclass', 4),
      p(/\binstance\s+\w+/, 'instance declaration', 5),
      p(/\bwhere\s*$/, 'where clause', 2),
      p(/\bdo\b/, 'do notation', 2),
      p(/\blet\s+\w+.*\bin\b/, 'let ... in', 3),
      p(/\b->\s*/, '-> (type arrow)', 1),
      p(/\b=>\s*/, '=> (constraint)', 1),
      p(/\b::\s*/, ':: (type annotation)', 3),
      p(/\bMaybe\b/, 'Maybe type', 5),
      p(/\bIO\b/, 'IO monad', 4),
      p(/\bJust\s+/, 'Just constructor', 4),
      p(/\bNothing\b/, 'Nothing constructor', 3),
      p(/\bputStrLn\b/, 'putStrLn', 5),
      p(/\bgetLine\b/, 'getLine', 4),
      p(/\bmap\s+\w+/, 'map function', 1),
      p(/\bfoldl\b|\bfoldr\b/, 'foldl/foldr', 5),
      p(/\bderiving\s*\(/, 'deriving clause', 5),
      p(/\bcase\s+\w+\s+of\b/, 'case ... of', 4),
      p(/\bguard\b|\b\|\s+\w+.*=/, 'guards |', 2),
      p(/\bnewtype\s+\w+/, 'newtype', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 24. Elixir
  // -----------------------------------------------------------------------
  {
    name: 'Elixir', id: 'elixir', ext: '.ex',
    patterns: [
      p(/\bdefmodule\s+\w+/, 'defmodule', 5),
      p(/\bdef\s+\w+/, 'def function', 2),
      p(/\bdefp\s+\w+/, 'defp private', 5),
      p(/\bdo\b/, 'do keyword', 1),
      p(/\bend\b/, 'end keyword', 1),
      p(/\|>/, '|> pipe', 4),
      p(/@doc\b/, '@doc attribute', 5),
      p(/@spec\b/, '@spec attribute', 5),
      p(/@moduledoc\b/, '@moduledoc', 5),
      p(/\bEnum\.\w+/, 'Enum.* module', 5),
      p(/\bcase\s+.*\bdo\b/, 'case ... do', 3),
      p(/\bcond\s+do\b/, 'cond do', 5),
      p(/\{:ok,\s*/, '{:ok, ...}', 5),
      p(/\{:error,\s*/, '{:error, ...}', 5),
      p(/\bfn\s+.*->\s*/, 'fn -> end', 4),
      p(/\bIO\.\w+/, 'IO.*', 3),
      p(/\bdefstruct\b/, 'defstruct', 5),
      p(/\bwith\s+/, 'with keyword', 1),
      p(/%\w+\{/, '%Struct{}', 5),
      p(/\bMap\.\w+/, 'Map.*', 4),
      p(/\bList\.\w+/, 'List.*', 3),
      p(/\bGenServer\b/, 'GenServer', 5),
      p(/\bAgent\.\w+/, 'Agent.*', 4),
      p(/\bTask\.\w+/, 'Task.*', 2),
    ],
  },

  // -----------------------------------------------------------------------
  // 25. Perl
  // -----------------------------------------------------------------------
  {
    name: 'Perl', id: 'perl', ext: '.pl',
    patterns: [
      p(/\buse\s+strict\b/, 'use strict', 5),
      p(/\buse\s+warnings\b/, 'use warnings', 5),
      p(/\bmy\s+\$\w+/, 'my $var', 5),
      p(/\bsub\s+\w+/, 'sub subroutine', 4),
      p(/\$_\b/, '$_ default var', 5),
      p(/@\w+/, '@array', 2),
      p(/%\w+/, '%hash', 2),
      p(/=~/, '=~ regex match', 5),
      p(/!~/, '!~ regex not match', 5),
      p(/\bqw\s*\(/, 'qw()', 5),
      p(/\bchomp\b/, 'chomp()', 5),
      p(/\bprint\s+/, 'print', 1),
      p(/\bdie\s+/, 'die()', 4),
      p(/\beval\s*\{/, 'eval { }', 3),
      p(/\bforeach\s+my\b/, 'foreach my', 4),
      p(/\bsay\s+/, 'say()', 4),
      p(/\bunless\b/, 'unless keyword', 3),
      p(/\bshift\b/, 'shift()', 3),
      p(/\bpush\b/, 'push()', 2),
      p(/\bpop\b/, 'pop()', 2),
      p(/\$\w+\[/, '$array[index]', 2),
      p(/\$\w+\{/, '$hash{key}', 3),
      p(/\buse\s+\w+::/, 'use Module::', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 26. YAML
  // -----------------------------------------------------------------------
  {
    name: 'YAML', id: 'yaml', ext: '.yml',
    patterns: [
      p(/^---\s*$/, '--- document start', 5),
      p(/^\w[\w-]*\s*:(\s|$)/, 'key: value', 3),
      p(/^\s*-\s+\w/, '- list item', 3),
      p(/\btrue\b/, 'true literal', 1),
      p(/\bfalse\b/, 'false literal', 1),
      p(/\bnull\b/, 'null literal', 1),
      p(/#\s+/, '# comment', 1),
      p(/^\s+\w[\w-]*\s*:/, 'indented key:', 3),
      p(/\*\w+/, '*anchor reference', 4),
      p(/&\w+/, '&anchor definition', 4),
      p(/<<:\s*\*\w+/, '<<: *merge key', 5),
      p(/\|\s*$/, '| literal block', 4),
      p(/>\s*$/, '> folded block', 4),
      p(/^\s*\w+:\s*\|/, 'multiline value', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 27. JSON
  // -----------------------------------------------------------------------
  {
    name: 'JSON', id: 'json', ext: '.json',
    patterns: [
      p(/^\s*\{/, '{ object start', 2),
      p(/"\w+":\s*/, '"key": value', 4),
      p(/"[^"]*":\s*"[^"]*"/, '"key": "string"', 4),
      p(/"[^"]*":\s*\d+/, '"key": number', 3),
      p(/"[^"]*":\s*\[/, '"key": [array]', 3),
      p(/"[^"]*":\s*\{/, '"key": {object}', 3),
      p(/\btrue\b/, 'true literal', 1),
      p(/\bfalse\b/, 'false literal', 1),
      p(/\bnull\b/, 'null literal', 1),
    ],
  },

  // -----------------------------------------------------------------------
  // 28. Markdown
  // -----------------------------------------------------------------------
  {
    name: 'Markdown', id: 'markdown', ext: '.md',
    patterns: [
      p(/^#{1,6}\s+\w/, '# heading', 5),
      p(/\*\*\w+.*\*\*/, '**bold**', 4),
      p(/\*\w+.*\*/, '*italic*', 2),
      p(/\[.*\]\(.*\)/, '[link](url)', 5),
      p(/^\s*-\s+\w/, '- list item', 2),
      p(/^\s*\d+\.\s+\w/, '1. ordered list', 3),
      p(/```/, '``` code fence', 5),
      p(/^>\s+\w/, '> blockquote', 4),
      p(/^---\s*$/, '--- horizontal rule', 2),
      p(/!\[.*\]\(.*\)/, '![image](url)', 5),
      p(/^\s*\|.*\|/, '| table |', 3),
      p(/`[^`]+`/, '`inline code`', 2),
    ],
  },

  // -----------------------------------------------------------------------
  // 29. TOML
  // -----------------------------------------------------------------------
  {
    name: 'TOML', id: 'toml', ext: '.toml',
    patterns: [
      p(/^\[\w[\w.-]*\]\s*$/, '[section]', 4),
      p(/^\[\[\w[\w.-]*\]\]\s*$/, '[[array table]]', 5),
      p(/^\w[\w-]*\s*=\s*"/, 'key = "value"', 3),
      p(/^\w[\w-]*\s*=\s*\d+/, 'key = number', 2),
      p(/^\w[\w-]*\s*=\s*(true|false)/, 'key = bool', 2),
      p(/\d{4}-\d{2}-\d{2}/, 'ISO date', 2),
      p(/^\w[\w-]*\s*=\s*\[/, 'key = [array]', 2),
      p(/#\s+/, '# comment', 1),
      p(/\[tool\./, '[tool.*] (pyproject)', 4),
      p(/\[package\]/, '[package]', 3),
      p(/\[dependencies\]/, '[dependencies]', 4),
      p(/\[dev-dependencies\]/, '[dev-dependencies]', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 30. Dockerfile
  // -----------------------------------------------------------------------
  {
    name: 'Dockerfile', id: 'dockerfile', ext: 'Dockerfile',
    patterns: [
      p(/^FROM\s+\w/, 'FROM image', 5),
      p(/^RUN\s+/, 'RUN command', 5),
      p(/^CMD\s+/, 'CMD', 5),
      p(/^COPY\s+/, 'COPY', 5),
      p(/^EXPOSE\s+\d+/, 'EXPOSE port', 5),
      p(/^ENV\s+\w+/, 'ENV variable', 4),
      p(/^WORKDIR\s+/, 'WORKDIR', 5),
      p(/^ENTRYPOINT\s+/, 'ENTRYPOINT', 5),
      p(/^ARG\s+\w+/, 'ARG variable', 5),
      p(/^LABEL\s+/, 'LABEL', 4),
      p(/^ADD\s+/, 'ADD', 4),
      p(/^VOLUME\s+/, 'VOLUME', 4),
      p(/^USER\s+\w+/, 'USER', 3),
      p(/^HEALTHCHECK\s+/, 'HEALTHCHECK', 5),
      p(/^SHELL\s+\[/, 'SHELL', 5),
      p(/^STOPSIGNAL\s+/, 'STOPSIGNAL', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 31. Terraform/HCL
  // -----------------------------------------------------------------------
  {
    name: 'Terraform', id: 'terraform', ext: '.tf',
    patterns: [
      p(/\bresource\s+"/, 'resource "type"', 5),
      p(/\bvariable\s+"/, 'variable "name"', 5),
      p(/\boutput\s+"/, 'output "name"', 5),
      p(/\bprovider\s+"/, 'provider "name"', 5),
      p(/\bmodule\s+"/, 'module "name"', 4),
      p(/\bdata\s+"/, 'data "source"', 4),
      p(/=\s*\{/, '= { block }', 1),
      p(/\bterraform\s*\{/, 'terraform { }', 5),
      p(/\blocals\s*\{/, 'locals { }', 5),
      p(/\baws_\w+/, 'aws_* resource', 4),
      p(/\bazurerm_\w+/, 'azurerm_* resource', 4),
      p(/\bgoogle_\w+/, 'google_* resource', 4),
      p(/\bvar\.\w+/, 'var.reference', 4),
      p(/\blocal\.\w+/, 'local.reference', 4),
      p(/\b(count|for_each)\s*=/, 'count/for_each', 4),
      p(/\bdepends_on\s*=/, 'depends_on', 5),
    ],
  },

  // -----------------------------------------------------------------------
  // 32. Vue
  // -----------------------------------------------------------------------
  {
    name: 'Vue', id: 'vue', ext: '.vue',
    patterns: [
      p(/<template[\s>]/, '<template>', 4),
      p(/<script\s+setup[\s>]/, '<script setup>', 5),
      p(/<style\s+scoped[\s>]/, '<style scoped>', 5),
      p(/\bdefineProps\s*\(/, 'defineProps()', 5),
      p(/\bdefineEmits\s*\(/, 'defineEmits()', 5),
      p(/\bref\s*\(/, 'ref()', 3),
      p(/\bcomputed\s*\(/, 'computed()', 3),
      p(/\breactive\s*\(/, 'reactive()', 4),
      p(/\bwatch\s*\(/, 'watch()', 2),
      p(/\bonMounted\s*\(/, 'onMounted()', 5),
      p(/v-if\s*=/, 'v-if directive', 5),
      p(/v-for\s*=/, 'v-for directive', 5),
      p(/v-bind\s*[:=]/, 'v-bind directive', 5),
      p(/v-model\s*=/, 'v-model directive', 5),
      p(/@click\s*=/, '@click handler', 3),
      p(/:class\s*=/, ':class binding', 3),
    ],
  },

  // -----------------------------------------------------------------------
  // 33. Svelte
  // -----------------------------------------------------------------------
  {
    name: 'Svelte', id: 'svelte', ext: '.svelte',
    patterns: [
      p(/<script[\s>]/, '<script>', 2),
      p(/\{#if\s+/, '{#if condition}', 5),
      p(/\{#each\s+/, '{#each array}', 5),
      p(/\{:else\}/, '{:else}', 5),
      p(/\{\/if\}/, '{/if}', 5),
      p(/\{\/each\}/, '{/each}', 5),
      p(/\$:\s+/, '$: reactive', 5),
      p(/on:click\s*=/, 'on:click handler', 5),
      p(/bind:value\s*=/, 'bind:value', 5),
      p(/bind:\w+\s*=/, 'bind:prop', 4),
      p(/\bexport\s+let\b/, 'export let (prop)', 3),
      p(/<slot[\s/>]/, '<slot> element', 3),
      p(/transition:\w+/, 'transition:*', 5),
      p(/animate:\w+/, 'animate:*', 5),
      p(/\{@html\s+/, '{@html raw}', 5),
      p(/<style[\s>]/, '<style>', 1),
    ],
  },

  // -----------------------------------------------------------------------
  // 34. WGSL/GLSL
  // -----------------------------------------------------------------------
  {
    name: 'WGSL/GLSL', id: 'wgsl', ext: '.wgsl',
    patterns: [
      p(/@vertex\b/, '@vertex', 5),
      p(/@fragment\b/, '@fragment', 5),
      p(/@compute\b/, '@compute', 5),
      p(/@binding\s*\(\d+\)/, '@binding(n)', 5),
      p(/@group\s*\(\d+\)/, '@group(n)', 5),
      p(/@location\s*\(\d+\)/, '@location(n)', 5),
      p(/\bvec[234]f?\b/, 'vec2/3/4', 4),
      p(/\bmat[234]x[234]f?\b/, 'mat4x4', 4),
      p(/\buniform\b/, 'uniform keyword', 3),
      p(/\bvarying\b/, 'varying keyword', 4),
      p(/\bgl_Position\b/, 'gl_Position', 5),
      p(/\bgl_FragColor\b/, 'gl_FragColor', 5),
      p(/\bvoid\s+main\s*\(\s*\)/, 'void main() (shader)', 2),
      p(/\bsampler2D\b/, 'sampler2D', 5),
      p(/\btexture\s*\(/, 'texture()', 3),
      p(/\bprecision\s+(highp|mediump|lowp)\b/, 'precision qualifier', 5),
      p(/#version\s+\d+/, '#version (GLSL)', 5),
      p(/\bin\s+vec[234]\b/, 'in vec* (attribute)', 4),
      p(/\bout\s+vec[234]\b/, 'out vec* (output)', 4),
      p(/\bfn\s+\w+\s*\(/, 'fn (WGSL function)', 2),
      p(/\b->\s*@/, '-> @(WGSL return)', 5),
    ],
  },
];

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

function scoreLanguage(
  code: string,
  lang: LanguageDef,
): { totalScore: number; matched: { label: string; weight: number }[] } {
  let totalScore = 0;
  const matched: { label: string; weight: number }[] = [];

  for (const pat of lang.patterns) {
    // Use multiline mode for patterns that start with ^
    const flags = pat.re.flags.includes('m') ? pat.re.flags : pat.re.flags + 'm';
    const re = new RegExp(pat.re.source, flags);
    if (re.test(code)) {
      totalScore += pat.weight;
      matched.push({ label: pat.label, weight: pat.weight });
    }
  }

  return { totalScore, matched };
}

// ---------------------------------------------------------------------------
// Disambiguation: penalize ambiguous languages when counterpart scores higher
// ---------------------------------------------------------------------------

function applyDisambiguation(
  results: { lang: LanguageDef; totalScore: number; matched: { label: string; weight: number }[] }[],
  code: string,
): void {
  const scoreMap = new Map(results.map(r => [r.lang.id, r.totalScore]));

  // TypeScript vs JavaScript: if TS scores higher and has type annotations, penalize JS
  const tsScore = scoreMap.get('typescript') ?? 0;
  const jsScore = scoreMap.get('javascript') ?? 0;
  if (tsScore > jsScore && tsScore > 0) {
    const jsResult = results.find(r => r.lang.id === 'javascript');
    if (jsResult) jsResult.totalScore *= 0.6;
  } else if (jsScore > 0 && tsScore > 0 && jsScore >= tsScore) {
    // If JS wins but no strong TS signals, reduce TS
    const tsResult = results.find(r => r.lang.id === 'typescript');
    if (tsResult) tsResult.totalScore *= 0.7;
  }

  // C vs C++: if C++ has std:: or iostream, penalize C
  const cppScore = scoreMap.get('cpp') ?? 0;
  const cScore = scoreMap.get('c') ?? 0;
  if (cppScore > cScore && cppScore > 0) {
    const cResult = results.find(r => r.lang.id === 'c');
    if (cResult) cResult.totalScore *= 0.5;
  } else if (cScore > cppScore && cScore > 0) {
    const cppResult = results.find(r => r.lang.id === 'cpp');
    if (cppResult) cppResult.totalScore *= 0.6;
  }

  // Java vs Kotlin: if Kotlin has fun/val/when, penalize Java
  const ktScore = scoreMap.get('kotlin') ?? 0;
  const javaScore = scoreMap.get('java') ?? 0;
  if (ktScore > javaScore && ktScore > 0) {
    const javaResult = results.find(r => r.lang.id === 'java');
    if (javaResult) javaResult.totalScore *= 0.5;
  }

  // Objective-C vs Swift
  const objcScore = scoreMap.get('objectivec') ?? 0;
  const swiftScore = scoreMap.get('swift') ?? 0;
  if (swiftScore > objcScore && swiftScore > 0) {
    const objcResult = results.find(r => r.lang.id === 'objectivec');
    if (objcResult) objcResult.totalScore *= 0.5;
  }

  // JSON vs YAML vs TOML: structural disambiguation
  const jsonScore = scoreMap.get('json') ?? 0;
  const yamlScore = scoreMap.get('yaml') ?? 0;
  // If code starts with { and has no # comments, strongly favor JSON
  if (jsonScore > 0 && code.trimStart().startsWith('{') && !code.includes('#')) {
    const yamlResult = results.find(r => r.lang.id === 'yaml');
    if (yamlResult) yamlResult.totalScore *= 0.3;
  }
  // If code has indented key: value but no braces at top, favor YAML
  if (yamlScore > 0 && !code.trimStart().startsWith('{') && !code.trimStart().startsWith('[')) {
    const jsonResult = results.find(r => r.lang.id === 'json');
    if (jsonResult) jsonResult.totalScore *= 0.3;
  }

  // Markdown vs YAML: if it has headings (#) and links, favor Markdown
  const mdScore = scoreMap.get('markdown') ?? 0;
  if (mdScore > yamlScore) {
    const yamlResult = results.find(r => r.lang.id === 'yaml');
    if (yamlResult) yamlResult.totalScore *= 0.5;
  }

  // Shell vs Python: elif exists in both, but fi/then are shell-only
  const shellScore = scoreMap.get('shell') ?? 0;
  const pyScore = scoreMap.get('python') ?? 0;
  if (shellScore > pyScore && /\bfi\b/.test(code)) {
    const pyResult = results.find(r => r.lang.id === 'python');
    if (pyResult) pyResult.totalScore *= 0.5;
  }
}

// ---------------------------------------------------------------------------
// Main detection function
// ---------------------------------------------------------------------------

export function detectLanguage(code: string): DetectionResult {
  const empty: DetectionResult = {
    language: 'Unknown',
    languageId: 'unknown',
    confidence: 0,
    scores: [],
    signals: [],
    fileExtension: '',
  };

  if (!code.trim()) return empty;

  // 1. Check shebang first
  const shebangLang = detectShebang(code);
  if (shebangLang) {
    const lang = LANGUAGES.find(l => l.id === shebangLang);
    if (lang) {
      const { matched } = scoreLanguage(code, lang);
      return {
        language: lang.name,
        languageId: lang.id,
        confidence: 0.95,
        scores: [{ language: lang.name, id: lang.id, score: 1 }],
        signals: matched.map(m => `${m.label} (w${m.weight})`),
        fileExtension: lang.ext,
      };
    }
  }

  // 2. Score all languages
  const results = LANGUAGES.map(lang => {
    const { totalScore, matched } = scoreLanguage(code, lang);
    return { lang, totalScore, matched };
  });

  // 3. Disambiguation
  applyDisambiguation(results, code);

  // 4. Sort by score descending
  results.sort((a, b) => b.totalScore - a.totalScore);

  const best = results[0];
  if (!best || best.totalScore === 0) return empty;

  // 5. Compute confidence: gap between top and second
  const second = results[1];
  const confidence = second && second.totalScore > 0
    ? Math.min(1, Math.max(0.1, (best.totalScore - second.totalScore) / best.totalScore))
    : best.totalScore > 0 ? 0.9 : 0;

  // 6. Normalize scores for top 5
  const maxScore = best.totalScore;
  const top5 = results.slice(0, 5)
    .filter(r => r.totalScore > 0)
    .map(r => ({
      language: r.lang.name,
      id: r.lang.id,
      score: Math.round((r.totalScore / maxScore) * 100) / 100,
    }));

  // 7. Collect signals from the winner
  const signals = best.matched
    .sort((a, b) => b.weight - a.weight)
    .map(m => `${m.label} (w${m.weight})`);

  return {
    language: best.lang.name,
    languageId: best.lang.id,
    confidence: Math.round(confidence * 100) / 100,
    scores: top5,
    signals,
    fileExtension: best.lang.ext,
  };
}
