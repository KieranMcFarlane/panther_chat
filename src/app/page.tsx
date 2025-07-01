'use client';

import React from 'react';
import { useChat, type Message } from 'ai/react';

// Define the progress component on the client
function ProgressComponent({ logs }: { logs: string[] }) {
  const [allLogs, setAllLogs] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (logs.length > 0) {
      setAllLogs(prevLogs => [...prevLogs, ...logs]);
    }
  }, [logs]);

  return (
    <details open>
      <summary>Research Progress</summary>
      <pre className="text-xs text-gray-500">
        {allLogs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </pre>
    </details>
  );
}

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, experimental_streamUI } = useChat({
    experimental: {
      streamUI: {
        components: {
          ProgressComponent,
        },
      },
    },
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((m: Message) => (
        <div key={m.id} className="whitespace-pre-wrap">
          <strong>{`${m.role}: `}</strong>
          {m.content}
          {m.experimental_ui}
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-center items-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}
      
      {experimental_streamUI}

      <form onSubmit={handleSubmit}>
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
} 