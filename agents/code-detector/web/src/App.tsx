import { useState, useEffect, useRef } from 'react';
import { detectLanguage, type DetectionResult } from './detector';

// ---------------------------------------------------------------------------
// Quick-insert code samples
// ---------------------------------------------------------------------------

const SAMPLES: { label: string; code: string }[] = [
  {
    label: 'JavaScript',
    code: `const express = require('express');
const app = express();

app.get('/', (req, res) => {
  const message = { hello: 'world' };
  console.log('Request received');
  res.json(message);
});

module.exports = app;`,
  },
  {
    label: 'TypeScript',
    code: `interface User {
  id: number;
  name: string;
  email: string;
  readonly createdAt: Date;
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`);
  return res.json() as Promise<User>;
}

export type { User };`,
  },
  {
    label: 'Python',
    code: `from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    name: str
    email: str
    age: Optional[int] = None

    def greet(self) -> str:
        return f"Hello, {self.name}!"

if __name__ == "__main__":
    user = User(name="Alice", email="alice@example.com")
    print(user.greet())`,
  },
  {
    label: 'Rust',
    code: `use std::collections::HashMap;

#[derive(Debug)]
struct Config {
    values: HashMap<String, String>,
}

impl Config {
    fn new() -> Self {
        Config { values: HashMap::new() }
    }

    pub fn get(&self, key: &str) -> Option<&String> {
        self.values.get(key)
    }
}

fn main() {
    let mut config = Config::new();
    config.values.insert("key".to_string(), "value".to_string());
    println!("{:?}", config.get("key").unwrap());
}`,
  },
  {
    label: 'Go',
    code: `package main

import (
    "fmt"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    if name == "" {
        name = "World"
    }
    fmt.Fprintf(w, "Hello, %s!", name)
}

func main() {
    http.HandleFunc("/", handler)
    if err := http.ListenAndServe(":8080", nil); err != nil {
        panic(err)
    }
}`,
  },
  {
    label: 'SQL',
    code: `CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > '2024-01-01'
GROUP BY u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC;`,
  },
  {
    label: 'HTML/CSS',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Page</title>
</head>
<body>
    <div class="container">
        <h1 id="title">Hello World</h1>
        <p>Welcome to my <a href="/about">website</a>.</p>
        <img src="hero.jpg" alt="Hero image" />
    </div>
</body>
</html>`,
  },
  {
    label: 'Shell',
    code: `#!/bin/bash
set -euo pipefail

export APP_ENV="production"

if [ -z "\${API_KEY:-}" ]; then
    echo "Error: API_KEY not set"
    exit 1
fi

for file in *.log; do
    echo "Processing $file..."
    grep -c "ERROR" "$file" || true
done

echo "All done."`,
  },
  {
    label: 'C++',
    code: `#include <iostream>
#include <vector>
#include <algorithm>

class Sorter {
public:
    static void sort(std::vector<int>& nums) {
        std::sort(nums.begin(), nums.end());
    }

    static void print(const std::vector<int>& nums) {
        for (const auto& n : nums) {
            std::cout << n << " ";
        }
        std::cout << std::endl;
    }
};

int main() {
    std::vector<int> numbers = {5, 2, 8, 1, 9};
    Sorter::sort(numbers);
    Sorter::print(numbers);
    return 0;
}`,
  },
  {
    label: 'Kotlin',
    code: `data class User(val name: String, val email: String)

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
}

fun fetchUser(id: Int): Result<User> {
    return when {
        id <= 0 -> Result.Error("Invalid ID")
        else -> Result.Success(User("Alice", "alice@example.com"))
    }
}

fun main() {
    val result = fetchUser(1)
    when (result) {
        is Result.Success -> println("Got: \${result.data.name}")
        is Result.Error -> println("Error: \${result.message}")
    }
}`,
  },
];

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<DetectionResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!code.trim()) {
      setResult(null);
      return;
    }
    timerRef.current = setTimeout(() => {
      setResult(detectLanguage(code));
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [code]);

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Code Detector
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          Evolved — 8000 snippets
        </span>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-4">
        {/* Code input */}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste any code snippet to detect its language..."
          spellCheck={false}
          className="w-full h-48 p-4 rounded-lg bg-neutral-900 border border-neutral-800 resize-none focus:outline-none focus:border-neutral-600 text-neutral-100 placeholder:text-neutral-600"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '1.6', tabSize: 2 }}
        />

        {/* Quick example buttons */}
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              onClick={() => setCode(s.code)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Result card */}
        {result && result.languageId !== 'unknown' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
            {/* Primary result */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xl font-bold text-neutral-100">
                  {result.language}
                </div>
                <div className="text-sm text-neutral-500" style={{ fontFamily: 'var(--font-mono)' }}>
                  {result.fileExtension}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-neutral-400">Confidence</div>
                <div className="text-lg font-bold text-neutral-100">
                  {(result.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${result.confidence * 100}%`,
                  backgroundColor: result.confidence > 0.7
                    ? '#22c55e'
                    : result.confidence > 0.4
                      ? '#eab308'
                      : '#ef4444',
                }}
              />
            </div>

            {/* Top 5 candidates */}
            {result.scores.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
                  Top candidates
                </div>
                {result.scores.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-4 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                      {i + 1}
                    </span>
                    <span className={`text-sm ${i === 0 ? 'text-neutral-100 font-medium' : 'text-neutral-400'}`}>
                      {s.language}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden ml-2">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${s.score * 100}%`,
                          backgroundColor: i === 0 ? '#7c3aed' : '#525252',
                        }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 w-12 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                      {(s.score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Matched signals */}
            {result.signals.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-neutral-500 font-medium uppercase tracking-wide">
                  Matched signals
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.signals.map((sig, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-400"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && result.languageId === 'unknown' && code.trim() && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-neutral-500 text-sm">
            Could not detect language. Try pasting a longer or more distinctive snippet.
          </div>
        )}

        <p className="text-xs text-neutral-600">
          Paste any code — no file extension needed. 30 languages, pure pattern scoring, zero model.
        </p>
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Heuristic agent — zero model, zero inference, zero cost.
      </footer>
    </div>
  );
}
