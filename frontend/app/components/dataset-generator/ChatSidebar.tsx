'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import IconButton from '@mui/material/IconButton';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';
import { renderAssistantMarkdown } from '../../utils/renderAssistantMarkdown';
import {
  applyFormUpdates,
  buildChatFormContext,
  type LLMFormUpdates,
} from '../../dataset-generator/formUpdates';
import type {
  DescriptorGroup,
  FormulationGroup,
} from '../../dataset-generator/types';

interface ChatSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generalInputs: DescriptorGroup[];
  formulationGroups: FormulationGroup[];
  outputs: DescriptorGroup[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  setGeneralInputs: (inputs: DescriptorGroup[]) => void;
  setFormulationGroups: (groups: FormulationGroup[]) => void;
  setOutputs: (outputs: DescriptorGroup[]) => void;
  setNumRows: (n: number | '') => void;
  setNoise: (n: number) => void;
  setFilename: (f: string) => void;
  setMinIngredientsPerFormulation: (s: string) => void;
  setMaxIngredientsPerFormulation: (s: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  formUpdateSummary?: string;
  sources?: ChatSource[];
}

interface ChatSource {
  title: string;
  url: string;
  snippet?: string;
}


export default function ChatSidebar({
  open,
  onOpenChange,
  generalInputs,
  formulationGroups,
  outputs,
  numRows,
  noise,
  filename,
  minIngredientsPerFormulation,
  maxIngredientsPerFormulation,
  setGeneralInputs,
  setFormulationGroups,
  setOutputs,
  setNumRows,
  setNoise,
  setFilename,
  setMinIngredientsPerFormulation,
  setMaxIngredientsPerFormulation,
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(154);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const MIN_PANEL_WIDTH = 420;
  const [panelWidth, setPanelWidth] = useState(500);
  const widthDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      if (widthDragRef.current) {
        const delta = widthDragRef.current.startX - clientX;
        const maxWidth = window.innerWidth;
        setPanelWidth(
          Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, widthDragRef.current.startWidth + delta)),
        );
        return;
      }
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - clientY;
      setTextareaHeight(Math.min(300, Math.max(60, dragRef.current.startHeight + delta)));
    }
    function onUp() {
      dragRef.current = null;
      widthDragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const buildFormContext = useCallback(
    () => buildChatFormContext({
      generalInputs,
      formulationGroups,
      outputs,
      numRows,
      noise,
      filename,
      minIngredientsPerFormulation,
      maxIngredientsPerFormulation,
    }),
    [generalInputs, formulationGroups, outputs, numRows, noise, filename, minIngredientsPerFormulation, maxIngredientsPerFormulation],
  );

  function applyIncomingFormUpdates(updates: LLMFormUpdates): string {
    const { next, summary } = applyFormUpdates({
      generalInputs,
      formulationGroups,
      outputs,
      numRows,
      noise,
      filename,
      minIngredientsPerFormulation,
      maxIngredientsPerFormulation,
    }, updates);

    if (next.generalInputs !== generalInputs) setGeneralInputs(next.generalInputs);
    if (next.formulationGroups !== formulationGroups) setFormulationGroups(next.formulationGroups);
    if (next.outputs !== outputs) setOutputs(next.outputs);
    if (next.numRows !== numRows) setNumRows(next.numRows);
    if (next.noise !== noise) setNoise(next.noise);
    if (next.filename !== filename) setFilename(next.filename);
    if (next.minIngredientsPerFormulation !== minIngredientsPerFormulation) {
      setMinIngredientsPerFormulation(next.minIngredientsPerFormulation);
    }
    if (next.maxIngredientsPerFormulation !== maxIngredientsPerFormulation) {
      setMaxIngredientsPerFormulation(next.maxIngredientsPerFormulation);
    }

    return summary;
  }


  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const conversationHistory = updatedMessages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch('./api/chat/dataset-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversation_history: conversationHistory.slice(0, -1),
          form_state: buildFormContext(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Request failed');
      }

      const data = await response.json();
      let summary = '';
      if (data.form_updates) {
        summary = applyIncomingFormUpdates(data.form_updates);
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Done.',
        formUpdateSummary: summary || undefined,
        sources: Array.isArray(data.sources) && data.sources.length > 0
          ? data.sources
          : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  }


  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }


  return (
    <>
      {!open && (
        <IconButton
          onClick={() => onOpenChange(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
            bgcolor: '#2563eb',
            color: 'white',
            width: 56,
            height: 56,
            boxShadow: 3,
            '&:hover': { bgcolor: '#1d4ed8' },
          }}
        >
          <ChatIcon />
        </IconButton>
      )}

      <div
        style={{ width: panelWidth }}
        className={`fixed top-0 right-0 h-full max-w-full flex flex-col bg-white border-l-2 border-gray-300 shadow-xl z-[1200] transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Horizontal resize handle */}
        <div
          className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize z-10 hover:bg-blue-400/40 active:bg-blue-500/50"
          onMouseDown={e => {
            widthDragRef.current = { startX: e.clientX, startWidth: panelWidth };
            e.preventDefault();
          }}
          onTouchStart={e => {
            widthDragRef.current = { startX: e.touches[0].clientX, startWidth: panelWidth };
          }}
        />
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="text-base font-semibold">Dataset Generator AI Assistant</h2>
          <IconButton size="small" onClick={() => onOpenChange(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-sm text-gray-400 text-center mt-8">
              <p className="mb-2 font-medium text-gray-500">How can I help?</p>
              <p>Describe the type of formulation problem you want to model, and I&apos;ll populate the form for you.</p>
              <p className="mt-4 text-xs text-gray-400">
                Example #1: &quot;Set up a dataset for DLP 3D printing resins, including ingredients like the following: UDMA as an oligomer, IBOA, HDDA, and GCMA as monomers, and Irganox 819 as a photoinitiator. Feel free to expand on this list of ingredients with additional examples.&quot; {/* TODO: Change this to a better example */}
              </p>
              <p className="mt-4 text-xs text-gray-400">
                Example #2: &quot;Ice cream emulsifier optimization dataset&quot; {/* TODO: Change this to a better example */}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white whitespace-pre-wrap'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div
                    className="assistant-markdown"
                    dangerouslySetInnerHTML={{ __html: renderAssistantMarkdown(msg.content) }}
                  />
                ) : (
                  msg.content
                )}
                {msg.formUpdateSummary && (
                  <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-green-700 font-medium">
                    <div className="mb-0.5">Updated:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {msg.formUpdateSummary.split('\n').map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-500 mb-1">References</div>
                    <ol className="assistant-sources space-y-1.5">
                      {msg.sources.map((source, j) => (
                        <li key={j} className="text-xs">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {source.title || source.url}
                          </a>
                          {source.snippet && (
                            <p className="text-gray-500 mt-0.5 line-clamp-2">{source.snippet}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <CircularProgress size={16} />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white">
          <div
            className="flex justify-center cursor-ns-resize select-none py-1"
            onMouseDown={e => {
              dragRef.current = { startY: e.clientY, startHeight: textareaHeight };
              e.preventDefault();
            }}
            onTouchStart={e => {
              dragRef.current = { startY: e.touches[0].clientY, startHeight: textareaHeight };
            }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-end gap-2 px-3 pb-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a synthetic dataset you want to generate..."
              style={{ height: textareaHeight }}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <IconButton
              onClick={handleSend}
              disabled={!input.trim() || loading}
              sx={{
                bgcolor: input.trim() && !loading ? '#2563eb' : '#d1d5db',
                color: 'white',
                '&:hover': { bgcolor: input.trim() && !loading ? '#1d4ed8' : '#d1d5db' },
                '&.Mui-disabled': { color: 'white', bgcolor: '#d1d5db' },
              }}
            >
              <SendIcon fontSize="small" />
            </IconButton>
          </div>
        </div>
      </div>
    </>
  );
}
