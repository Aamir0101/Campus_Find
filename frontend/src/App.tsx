import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { PreviewStateProvider } from './hooks/usePreviewContext';
import { AppRoutes } from './routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreviewStateProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PreviewStateProvider>
    </QueryClientProvider>
  );
}

export default App;
