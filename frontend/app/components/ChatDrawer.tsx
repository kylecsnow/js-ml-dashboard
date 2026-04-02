'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import CircularProgress from '@mui/material/CircularProgress';

export interface DescriptorGroup {
  id: string;
  name: string;
  min: string;
  max: string;
  units: string;
}

interface ChatDrawerProps {
  generalInputs: DescriptorGroup[];
  formulationInputs: DescriptorGroup[];
  outputs: DescriptorGroup[];
  numRows: number | '';
  noise: number;
  filename: string;
  minIngredientsPerFormulation: string;
  maxIngredientsPerFormulation: string;
  setGeneralInputs: (inputs: DescriptorGroup[]) => void;
  setFormulationInputs: (inputs: DescriptorGroup[]) => void;
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
}

interface LLMFormUpdates {
  general_inputs?: { name: string; min: string; max: string; units?: string }[];
  formulation_inputs?: { name: string; min: string; max: string }[];
  outputs?: { name: string; min: string; max: string; units?: string }[];
  num_rows?: number;
  noise?: number;
  filename?: string;
  min_ingredients_per_formulation?: number | null;
  max_ingredients_per_formulation?: number | null;
}


export default function ChatDrawer({
  generalInputs,
  formulationInputs,
  outputs,
  numRows,
  noise,
  filename,
  minIngredientsPerFormulation,
  maxIngredientsPerFormulation,
  setGeneralInputs,
  setFormulationInputs,
  setOutputs,
  setNumRows,
  setNoise,
  setFilename,
  setMinIngredientsPerFormulation,
  setMaxIngredientsPerFormulation,
}: ChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildFormContext = useCallback(() => ({
    general_inputs: generalInputs.map(g => ({ name: g.name, min: g.min, max: g.max, units: g.units })),
    formulation_inputs: formulationInputs.map(g => ({ name: g.name, min: g.min, max: g.max })),
    outputs: outputs.map(g => ({ name: g.name, min: g.min, max: g.max, units: g.units })),
    num_rows: numRows,
    noise,
    filename,
    min_ingredients_per_formulation: minIngredientsPerFormulation || null,
    max_ingredients_per_formulation: maxIngredientsPerFormulation || null,
  }), [generalInputs, formulationInputs, outputs, numRows, noise, filename, minIngredientsPerFormulation, maxIngredientsPerFormulation]);

  function applyFormUpdates(updates: LLMFormUpdates): string {
    const parts: string[] = [];

    if (updates.general_inputs !== undefined) {
      const items = updates.general_inputs.map(g => ({
        id: crypto.randomUUID(),
        name: g.name,
        min: String(g.min),
        max: String(g.max),
        units: g.units ?? '',
      }));
      setGeneralInputs(items);
      parts.push(`${items.length} general input${items.length !== 1 ? 's' : ''}`);
    }

    if (updates.formulation_inputs !== undefined) {
      const items = updates.formulation_inputs.map(g => ({
        id: crypto.randomUUID(),
        name: g.name,
        min: String(g.min),
        max: String(g.max),
        units: '',
      }));
      setFormulationInputs(items);
      parts.push(`${items.length} formulation input${items.length !== 1 ? 's' : ''}`);
    }

    if (updates.outputs !== undefined) {
      const items = updates.outputs.map(g => ({
        id: crypto.randomUUID(),
        name: g.name,
        min: String(g.min),
        max: String(g.max),
        units: g.units ?? '',
      }));
      setOutputs(items);
      parts.push(`${items.length} output${items.length !== 1 ? 's' : ''}`);
    }

    if (updates.num_rows !== undefined && updates.num_rows !== numRows) {
      setNumRows(updates.num_rows);
      parts.push('num_rows');
    }
    if (updates.noise !== undefined && updates.noise !== noise) {
      setNoise(updates.noise);
      parts.push('noise');
    }
    if (updates.filename !== undefined && updates.filename !== filename) {
      setFilename(updates.filename);
      parts.push('filename');
    }
    const newMin = updates.min_ingredients_per_formulation != null
      ? String(updates.min_ingredients_per_formulation)
      : '';
    if (updates.min_ingredients_per_formulation !== undefined && newMin !== minIngredientsPerFormulation) {
      setMinIngredientsPerFormulation(newMin);
      parts.push('min ingredients/formulation');
    }
    const newMax = updates.max_ingredients_per_formulation != null
      ? String(updates.max_ingredients_per_formulation)
      : '';
    if (updates.max_ingredients_per_formulation !== undefined && newMax !== maxIngredientsPerFormulation) {
      setMaxIngredientsPerFormulation(newMax);
      parts.push('max ingredients/formulation');
    }

    return parts.length > 0 ? parts.join('\n') : '';
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
        summary = applyFormUpdates(data.form_updates);
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Done.',
        formUpdateSummary: summary || undefined,
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
          onClick={() => setOpen(true)}
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

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: { width: 420, maxWidth: '100vw', display: 'flex', flexDirection: 'column' },
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <h2 className="text-base font-semibold">Dataset Generator Assistant</h2>
          <IconButton size="small" onClick={() => setOpen(false)}>
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
                Example: &quot;Set up a dataset for DLP 3D printing resins with UDMA, IBOA, HDDA, GCMA, and Irganox 819 as ingredients.&quot; {/* TODO: Change this to a better example */}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                {msg.content}
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
        <div className="border-t border-gray-200 p-3 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your formulation problem..."
              rows={2}
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
      </Drawer>
    </>
  );
}
