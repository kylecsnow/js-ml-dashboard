'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

export interface FormulationDescriptorGroup extends DescriptorGroup {
  required: boolean;
}

export interface FormulationGroup {
  id: string;
  name: string;
  min: string;            // group quantity sum lower bound (0..1)
  max: string;            // group quantity sum upper bound (0..1)
  minIngredients: string; // optional per-group min present ingredients count
  maxIngredients: string; // optional per-group max present ingredients count
  ingredients: FormulationDescriptorGroup[];
}

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
}

interface LLMFormulationGroup {
  name: string;
  min: string;
  max: string;
  min_ingredients?: number | string | null;
  max_ingredients?: number | string | null;
  ingredients: { name: string; min: string; max: string; required?: boolean }[];
}

interface LLMFormUpdates {
  general_inputs?: { name: string; min: string; max: string; units?: string }[];
  formulation_groups?: LLMFormulationGroup[];
  outputs?: { name: string; min: string; max: string; units?: string }[];
  num_rows?: number;
  noise?: number;
  filename?: string;
  min_ingredients_per_formulation?: number | null;
  max_ingredients_per_formulation?: number | null;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const delta = dragRef.current.startY - clientY;
      setTextareaHeight(Math.min(300, Math.max(60, dragRef.current.startHeight + delta)));
    }
    function onUp() { dragRef.current = null; }
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

  const buildFormContext = useCallback(() => ({
    general_inputs: generalInputs.map(g => ({ name: g.name, min: g.min, max: g.max, units: g.units })),
    formulation_groups: formulationGroups.map(group => ({
      name: group.name,
      min: group.min,
      max: group.max,
      min_ingredients: group.minIngredients || null,
      max_ingredients: group.maxIngredients || null,
      ingredients: group.ingredients.map(i => ({
        name: i.name,
        min: i.min,
        max: i.max,
        required: i.required,
      })),
    })),
    outputs: outputs.map(g => ({ name: g.name, min: g.min, max: g.max, units: g.units })),
    num_rows: numRows,
    noise,
    filename,
    min_ingredients_per_formulation: minIngredientsPerFormulation || null,
    max_ingredients_per_formulation: maxIngredientsPerFormulation || null,
  }), [generalInputs, formulationGroups, outputs, numRows, noise, filename, minIngredientsPerFormulation, maxIngredientsPerFormulation]);

  function numEq(a: string | number, b: string | number): boolean {
    const na = Number(a);
    const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return String(a) === String(b);
  }

  function descriptorsChanged(
    current: DescriptorGroup[],
    incoming: { name: string; min: string; max: string; units?: string; required?: boolean }[],
  ): boolean {
    if (current.length !== incoming.length) return true;
    return incoming.some((g, i) =>
      g.name !== current[i].name ||
      !numEq(g.min, current[i].min) ||
      !numEq(g.max, current[i].max) ||
      (g.units ?? '') !== (current[i] as { units?: string }).units ||
      (g.required ?? false) !== ((current[i] as { required?: boolean }).required ?? false)
    );
  }

  function countEq(incoming: number | string | null | undefined, current: string): boolean {
    const inc = incoming == null || incoming === '' ? '' : String(Number(incoming));
    const cur = current.trim() === '' ? '' : String(Number(current));
    return inc === cur;
  }

  function groupsChanged(current: FormulationGroup[], incoming: LLMFormulationGroup[]): boolean {
    if (current.length !== incoming.length) return true;
    return incoming.some((g, i) => {
      const c = current[i];
      if (
        g.name !== c.name ||
        !numEq(g.min, c.min) ||
        !numEq(g.max, c.max) ||
        !countEq(g.min_ingredients, c.minIngredients) ||
        !countEq(g.max_ingredients, c.maxIngredients)
      ) {
        return true;
      }
      return descriptorsChanged(c.ingredients, g.ingredients);
    });
  }

  function applyFormUpdates(updates: LLMFormUpdates): string {
    const parts: string[] = [];

    if (updates.general_inputs !== undefined && descriptorsChanged(generalInputs, updates.general_inputs)) {
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

    if (updates.formulation_groups !== undefined && groupsChanged(formulationGroups, updates.formulation_groups)) {
      const groups: FormulationGroup[] = updates.formulation_groups.map(g => ({
        id: crypto.randomUUID(),
        name: g.name,
        min: String(g.min),
        max: String(g.max),
        minIngredients: g.min_ingredients == null ? '' : String(g.min_ingredients),
        maxIngredients: g.max_ingredients == null ? '' : String(g.max_ingredients),
        ingredients: (g.ingredients ?? []).map(i => ({
          id: crypto.randomUUID(),
          name: i.name,
          min: String(i.min),
          max: String(i.max),
          units: '',
          required: i.required ?? false,
        })),
      }));
      setFormulationGroups(groups);
      const ingredientCount = groups.reduce((n, grp) => n + grp.ingredients.length, 0);
      parts.push(
        `${groups.length} formulation group${groups.length !== 1 ? 's' : ''} ` +
        `(${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''})`
      );
    }

    if (updates.outputs !== undefined && descriptorsChanged(outputs, updates.outputs)) {
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
        className={`fixed top-0 right-0 h-full w-[420px] max-w-full flex flex-col bg-white border-l-2 border-gray-300 shadow-xl z-[1200] transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
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
