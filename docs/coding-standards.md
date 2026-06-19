# Coding Standards

General coding standards that apply to all implementations in the QRSPI flow.

## Core Principles

### Readability Over Cleverness
- Write code that a developer can read and understand without re-reading
- Prefer explicit over implicit
- Prefer straightforward logic over clever shortcuts
- If you need to explain why you did something clever, you did something too clever

### Meaningful Names
- Variables: describe what they hold (`user_count` not `uc`)
- Functions: describe what they do (`calculate_total` not `calc`)
- Classes: describe what they are (`UserProfile` not `Processor3`)
- Avoid abbreviations unless universally understood (`url` yes, `qry` no)

### Single Responsibility
- Functions do one thing well
- Classes have one reason to change
- Modules group related functionality
- If a function has "and" in its name, it probably does too much

### Error Handling
- Don't swallow errors — at minimum, log them
- Fail fast — detect problems early and report them
- Handle errors at the appropriate level — don't propagate them to the user if you can handle them locally
- Don't expose implementation details in error messages to end users

### Don't Repeat Yourself
- Extract common patterns into reusable functions or utilities
- DRY applies to logic, not just syntax
- But don't over-engineer abstractions for one-off cases (YAGNI)

## Structure

### File Organization
- One logical unit per file when possible
- Keep files reasonably sized (< 300 lines when practical)
- Group related code together
- Separate imports, constants, types, and implementation

### Import Organization
- Standard library imports first
- Third-party imports second
- Local/application imports third
- Sort alphabetically within groups

### Function Structure
- Short functions (ideally < 30 lines)
- Single level of abstraction per function
- Clear input/output contracts
- Document non-obvious behavior

## Language-Specific Notes

### Python
- Use type hints where they add clarity
- Follow PEP 8 for style
- Use f-strings for string formatting
- Use context managers for resource management
- Prefer list/dict comprehensions for simple transformations

### TypeScript/JavaScript
- Use TypeScript types over `any`
- Prefer `const` over `let`, avoid `var`
- Use async/await over raw promises
- Handle promise rejections
- Prefer arrow functions for callbacks, regular functions for methods

### Rust
- Follow idiomatic Rust conventions
- Use `Result` for recoverable errors
- Use `Option` for nullable values
- Prefer `match` over `if let` for exhaustiveness
- Use `clippy` for additional linting

### Go
- Follow `gofmt` output exactly
- Return errors explicitly, don't use exceptions
- Keep functions small and focused
- Prefer composition over inheritance
- Use interfaces for abstraction

## Anti-Patterns to Avoid

- **Magic numbers/strings** — name them
- **God functions** — break them up
- **God classes** — split responsibilities
- **Deeply nested conditionals** — extract or flatten
- **Hungarian notation** — let the type system do the work
- **Premature optimization** — write correct code first, profile before optimizing
- **Hardcoded values** — use configuration for environment-dependent values

## Comments

### When to Comment
- **Why, not what** — if the code doesn't explain what it does, the code needs work
- **Counter-intuitive decisions** — if there's a non-obvious reason for an approach
- **Known limitations** — if the implementation has deliberate trade-offs
- **Complex algorithms** — if the logic requires explanation beyond the code

### When Not to Comment
- **Trivial code** — `x = x + 1` doesn't need a comment saying "add one to x"
- **API documentation** — use docstrings/type annotations instead
- **Repeated comments** — if you're commenting the same thing across functions, refactor

### Comment Style
- Be concise and factual
- Avoid restating the code
- Update comments when code changes
- Use TODO comments for known future work: `TODO: Add error handling for network failures`
