import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/app/source';

const { GET: search } = createFromSource(source);

// Rough client classification so runtime logs show who is actually using the
// search endpoint (the only serverless function in this app).
function classifyClient(userAgent: string | null) {
  if (!userAgent) {
    return 'unknown';
  }

  if (
    /GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-Web|anthropic|PerplexityBot|Google-Extended|Bytespider|CCBot|meta-externalagent|Amazonbot|Applebot-Extended/i.test(
      userAgent,
    )
  ) {
    return 'ai-bot';
  }

  if (
    /bot|crawler|spider|crawling|curl|wget|python|httpx|node-fetch|axios|Go-http-client/i.test(
      userAgent,
    )
  ) {
    return 'bot';
  }

  return 'browser';
}

export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query');

  console.log(
    `[search] client=${classifyClient(request.headers.get('user-agent'))} queryLength=${query?.length ?? 0}`,
  );

  return search(request);
}
