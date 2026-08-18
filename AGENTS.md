<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Local Environment File Privacy Rule

- **Workspace Rule**: Agents must NEVER read, print, parse, search, source, inspect, or otherwise access `.env.local`, including through shell commands, scripts, application runtimes, dotenv loaders, or indirect tooling. Agents must not ask the user to paste secrets or the contents of `.env.local` into chat.
- **Manual Procedure Rule**: When environment configuration or verification is required, inspect only non-secret templates such as `.env.example` and source-code references, then give the user exact manual instructions. The user must add, change, inspect, and validate all `.env.local` values themselves.
- **Goal**: Keep local credentials and environment-specific secrets exclusively under the user's control and prevent their disclosure through agent context, command output, logs, or tool calls.

# Commit Styling Rule

- **Workspace Rule**: Always prepend or append random, fun, and contextual emojis to Git commit messages (e.g., `feat: 🚀 wire up database sync 🤖`).
- **Goal**: Infuse personality and improve visual scannability within project revision histories.
