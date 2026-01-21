'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import { useState, useEffect } from 'react'
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'

// Diff types (copied from page to avoid circular imports)
interface EmailClause {
  id: string;
  content: string;
  status: 'original' | 'proposed' | 'accepted' | 'rejected';
  diffType?: 'addition' | 'deletion' | 'modification';
  originalContent?: string;
  startIndex?: number;
  endIndex?: number;
}

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  highlightDiffs?: EmailClause[]
}

export default function TiptapEditor({ 
  content, 
  onChange, 
  placeholder = "Start writing...",
  className = "",
  highlightDiffs = []
}: TiptapEditorProps) {
  const [isClient, setIsClient] = useState(false)

  // Prevent SSR hydration issues
  useEffect(() => {
    setIsClient(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      CharacterCount.configure({
        limit: 10000, // Optional limit
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
        placeholder: placeholder,
      },
    },
  })

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!isClient) {
    return (
      <div className="border rounded-md">
        <div className="border-b p-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-8 h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
        <div className="p-4 min-h-[400px]">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    children, 
    title = "" 
  }: {
    onClick: () => void
    isActive?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <Toggle
      pressed={isActive}
      onPressedChange={onClick}
      title={title}
      size="sm"
      className="h-8 w-8 p-0"
    >
      {children}
    </Toggle>
  )

  return (
    <div className={`border rounded-md overflow-hidden h-full flex flex-col ${className}`}>
      {/* Toolbar */}
      <div className="border-b bg-muted/50 p-2">
        <div className="flex items-center gap-1 flex-wrap">
          {/* Undo/Redo */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          
          <ToolbarButton
            onClick={() => editor?.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor?.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor?.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor?.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Text Formatting */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            isActive={editor?.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            isActive={editor?.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            isActive={editor?.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            isActive={editor?.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Quote */}
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            isActive={editor?.isActive('blockquote')}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <EditorContent 
          editor={editor} 
          className="h-full prose prose-stone dark:prose-invert max-w-none focus:outline-none"
          style={{
            minHeight: '400px'
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="border-t bg-muted/30 px-3 py-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {editor?.storage.characterCount.words()} words • {editor?.storage.characterCount.characters()} characters
          </div>
          <div>
            {editor?.isActive('heading', { level: 1 }) && 'Heading 1'}
            {editor?.isActive('heading', { level: 2 }) && 'Heading 2'}
            {editor?.isActive('heading', { level: 3 }) && 'Heading 3'}
            {!editor?.isActive('heading') && 'Plain Text'}
          </div>
        </div>
      </div>
    </div>
  )
}