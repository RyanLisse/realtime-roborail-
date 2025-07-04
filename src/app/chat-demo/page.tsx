import React from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function ChatDemoPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[600px] bg-white rounded-lg shadow-lg">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">Chat Interface Demo</h1>
            <p className="text-gray-600 mt-1">Test the basic chat interface with text input/output</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface className="h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}