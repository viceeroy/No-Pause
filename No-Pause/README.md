# No Pause

A modern focus and productivity application designed to help you maintain flow state and minimize distractions during work sessions.

## Features

- **Focus Modes**: Multiple focus modes tailored to different types of work
- **Session Tracking**: Track your productivity and analyze patterns over time
- **Real-time Analytics**: Monitor your focus metrics and hesitation detection
- **Calibration System**: Personalized threshold settings for optimal focus detection
- **Statistics Dashboard**: Comprehensive insights into your productivity patterns
- **Practice Sessions**: Guided practice modes to improve focus and reduce hesitation

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui with Radix UI primitives
- **State Management**: React Query for server state
- **Routing**: React Router DOM
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Testing**: Vitest with React Testing Library

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/viceeroy/No-Pause.git
cd no-pause
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:8080`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run build:dev` - Build for development mode
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Project Structure

```
src/
├── components/          # Reusable UI components
├── lib/                # Utility functions and configurations
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
└── App.tsx             # Main application component
```

## Key Features Explained

### Focus Modes
No Pause offers different focus modes tailored to various work scenarios:
- **Free Speaking**: Practice verbal communication without hesitation
- **Deep Work**: Extended focus sessions for complex tasks
- **Quick Sprints**: Short, intense focus periods

### Analytics & Insights
The application tracks:
- Session duration and quality
- Hesitation patterns and frequency
- Flow state consistency
- Productivity trends over time

### Calibration System
Personalized settings that adapt to your unique working patterns:
- Ambient noise detection
- Custom hesitation thresholds
- Individual flow state indicators

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please:
- Check the [Issues](https://github.com/viceeroy/No-Pause/issues) page
- Create a new issue with detailed information
- Include steps to reproduce any bugs

## Acknowledgments

Built with modern web technologies to help you achieve your productivity goals and maintain focus in a distraction-filled world.
