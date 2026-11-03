# SplitWise

SplitWise is a web application for tracking shared expenses with friends, roommates, and groups. Add expenses, split costs between members, see who owes whom, and settle balances without awkward calculations.

## Features

- Create and manage expense groups.
- Add, edit, categorize, and split expenses among group members.
- Invite, view, and manage group members.
- View total balances, amounts owed, and amounts others owe you.
- Inspect unsettled transactions and settle up balances.
- Secure sign up, login, logout, password recovery, and password reset.
- Responsive dashboard with toast notifications and accessible UI components.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS, PostCSS, shadcn/ui, Radix UI
- **Routing and state:** React Router, TanStack React Query
- **Backend and authentication:** Supabase (PostgreSQL and Supabase Auth)
- **Forms and validation:** React Hook Form, Zod
- **Icons and visuals:** Lucide React, Recharts, Framer Motion
- **Testing and quality:** Vitest, Testing Library, Playwright, ESLint

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project

### Installation

```bash
npm install
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Start the development server:

```bash
npm run dev
```

The app is available at the local URL shown by Vite, usually `http://localhost:5173`.

## Available Scripts

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm run lint      # Run ESLint
npm test          # Run the test suite
```

## Project Structure

```text
src/
├── components/       Reusable UI and dashboard components
├── contexts/         Authentication context
├── integrations/     Supabase client and generated database types
├── pages/            Landing, authentication, dashboard, and error pages
├── hooks/            Shared React hooks
└── lib/              Shared utilities
supabase/             Supabase project configuration
```

## License

This project is private and intended for personal or authorized use.
