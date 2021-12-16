import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { AppProps } from 'next/app';
import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache(),
});

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApolloProvider client={client}>
        <Component {...pageProps} />
      </ApolloProvider>
    </QueryClientProvider>
  );
}

export default MyApp;
