# DeployStack Frontend

The frontend application is built with Vue 3, TypeScript, and Vite.

```bash
# Navigate to frontend directory
cd services/frontend

# Run development server
npm run dev

# Build for production
npm run build
```

## 🚀 Run

```bash
docker run -it -p 80:80 \
  -e FOO=bar22 \
  -e VITE_API_URL="kaczory" \
  deploystack/frontend:v0.10.0
```

## UI

Frontend is using TailwindCSS and [shadcn-vue](https://www.shadcn-vue.com/).

To install components please use:

```bash
npx shadcn-vue@latest add button
```

## Icons

The project uses [Lucide Icons](https://lucide.dev/) via the `lucide-vue-next` package.

### How to use icons

1. Import the specific icons you need:

```typescript
import { Mail, Lock, User, Settings } from 'lucide-vue-next'
```

2. Use them in your template:

```html
<Mail class="h-4 w-4 text-gray-500" />
<Lock class="h-4 w-4 text-gray-500" />
```

3. You can customize icons with classes:

```html
<!-- Change size -->
<Settings class="h-6 w-6" />

<!-- Change color -->
<User class="text-indigo-600" />

<!-- Position absolutely -->
<Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
```

## Environment Variables

The frontend application supports environment variables in both development and production Docker environments.

### Development Environment

For local development, create a `.env` file in the `services/frontend` directory:

```bash
VITE_API_URL=http://localhost:3000
VITE_APP_TITLE=DeployStack (Dev)
```

Vite will automatically load these variables when you run `npm run dev`.

### Production (Docker) Environment

In Docker production environment, you can pass environment variables using the `-e` flag:

```bash
docker run -it -p 80:80 \
  -e VITE_API_URL="https://api.example.com" \
  -e VITE_APP_TITLE="DeployStack (Prod)" \
  -e FOO="custom value" \
  deploystack/frontend:latest
```

### Accessing Environment Variables in Components

Use the `getEnv` utility function to access environment variables consistently across all environments:

```typescript
import { getEnv } from '@/utils/env';

// In your component:
const apiUrl = getEnv('VITE_API_URL');
const appTitle = getEnv('VITE_APP_TITLE');
const foo = getEnv('FOO');
```

### Adding New Environment Variables

1. **Add type definitions** in `env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_NEW_VARIABLE: string
  // add more variables here
}

interface Window {
  RUNTIME_ENV?: {
    VITE_API_URL?: string
    VITE_NEW_VARIABLE?: string
    // match the variables above
    FOO?: string
    // add any non-VITE variables here
  }
}
```

2. **For non-VITE variables** in Docker, update `env-config.sh` to include the variable name:

```bash
# Add specific non-VITE_ variables you want to expose
for var in FOO BAR NEW_VARIABLE; do
  # ...
done
```

3. **Use the variable** in your component with `getEnv('VARIABLE_NAME')`.

This approach provides a consistent way to access environment variables across all environments.

## Internationalization (i18n)

The project uses Vue I18n for internationalization with a modular file structure to organize translations by feature.

### Directory Structure

```bash
src/
├── i18n/
│   ├── index.ts               // Main i18n initialization
│   └── locales/
│       └── en/                // English translations
│           ├── index.ts       // Exports all English translations
│           ├── common.ts      // Common translations
│           ├── login.ts       // Login page specific translations
│           └── register.ts    // Register page specific translations
```

### Using i18n in Components

1. In the script section:

```typescript
import { useI18n } from 'vue-i18n'

// Inside setup function or script setup
const { t } = useI18n()

// Use in JavaScript
const message = t('login.title')
```

2. In the template section:

```html
<!-- Simple translation -->
<h1>{{ $t('login.title') }}</h1>

<!-- With parameters -->
<p>{{ $t('validation.required', { field: $t('login.form.email.label') }) }}</p>

<!-- In attributes -->
<Input :placeholder="$t('login.form.email.placeholder')" />
```

### Adding New Translations

1. For a new feature or page:

```typescript
// Create a new file: src/i18n/locales/en/feature-name.ts
export default {
  title: 'Feature Title',
  description: 'Feature description',
  // other translations...
}

// Add to src/i18n/locales/en/index.ts
import featureName from './feature-name'

export default {
  ...common,
  login,
  register,
  featureName
}
```

2. For a new language (e.g., German):

```typescript
// Create a folder structure similar to 'en' but with translated content
// src/i18n/locales/de/index.ts, common.ts, login.ts, etc.

// Update src/i18n/index.ts to include the new language
import { createI18n } from 'vue-i18n'
import en from './locales/en'
import de from './locales/de'

const i18n = createI18n({
  legacy: false,
  locale: 'en', // default language
  fallbackLocale: 'en',
  messages: {
    en,
    de
  }
})
```
