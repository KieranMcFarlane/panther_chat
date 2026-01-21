'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, X, Bold, Italic, List, Link as LinkIcon } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

interface ComposeEmailProps {
  open: boolean;
  onClose: () => void;
  onSend: () => void;
  replyTo?: {
    from: string;
    fromName: string;
    subject: string;
  };
}

export function ComposeEmail({ open, onClose, onSend, replyTo }: ComposeEmailProps) {
  const [to, setTo] = useState(replyTo?.from || '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [sending, setSending] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Only initialize editor on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Exclude the default Link extension to avoid duplicates
        link: false,
      }),
      Placeholder.configure({
        placeholder: 'Write your message here...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content: replyTo ? `<p><br></p><p>--- Original Message ---</p><p><strong>From:</strong> ${replyTo.fromName} &lt;${replyTo.from}&gt;</p><p><strong>Subject:</strong> ${replyTo.subject}</p><p><br></p>` : '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
    immediatelyRender: false,
  }, [isMounted, replyTo]);

  useEffect(() => {
    if (open && editor && isMounted && editor.commands) {
      editor.commands.focus();
    }
  }, [open, editor, isMounted]);

  // Update content when replyTo changes
  useEffect(() => {
    if (editor && replyTo && isMounted && editor.commands) {
      editor.commands.setContent(`<p><br></p><p>--- Original Message ---</p><p><strong>From:</strong> ${replyTo.fromName} &lt;${replyTo.from}&gt;</p><p><strong>Subject:</strong> ${replyTo.subject}</p><p><br></p>`);
    } else if (editor && !replyTo && isMounted && editor.commands) {
      editor.commands.clearContent();
    }
  }, [editor, replyTo, isMounted]);

  const handleSend = async () => {
    if (!to || !subject || !editor) {
      alert('Please fill in all required fields');
      return;
    }

    const htmlBody = editor.getHTML();
    // Fix line breaks in text body - replace literal \n with actual line breaks
    const rawTextBody = editor.getText();
    const textBody = rawTextBody.replace(/\\n/g, '\n');

    if (!htmlBody.trim() || htmlBody === '<p></p>') {
      alert('Please write a message');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/mailbox/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to.split(',').map(email => email.trim()),
          subject,
          body: htmlBody,
          textBody,
          cc: cc ? cc.split(',').map(email => email.trim()) : undefined,
          bcc: bcc ? bcc.split(',').map(email => email.trim()) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }

      const result = await response.json();
      console.log('Email sent:', result);

      // Reset form
      setTo('');
      setSubject('');
      setCc('');
      setBcc('');
      if (editor && editor.commands) {
        editor.commands.clearContent();
      }

      onSend();
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      alert(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setTo('');
      setSubject('');
      setCc('');
      setBcc('');
      editor?.commands.clearContent();
      onClose();
    }
  };

  // Don't render editor until mounted on client
  if (!isMounted || !editor) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{replyTo ? 'Reply' : 'Compose Email'}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground">Loading editor...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{replyTo ? 'Reply' : 'Compose Email'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="to">To *</Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              disabled={sending}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cc">CC</Label>
              <Input
                id="cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                disabled={sending}
              />
            </div>
            <div>
              <Label htmlFor="bcc">BCC</Label>
              <Input
                id="bcc"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="bcc@example.com"
                disabled={sending}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              disabled={sending}
            />
          </div>

          <div>
            <Label>Message *</Label>
            {/* Toolbar */}
            <div className="border border-border rounded-t-md p-2 flex gap-1 bg-muted">
              <Toggle
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                size="sm"
                disabled={sending}
              >
                <Bold className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                size="sm"
                disabled={sending}
              >
                <Italic className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={editor.isActive('bulletList')}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                size="sm"
                disabled={sending}
              >
                <List className="h-4 w-4" />
              </Toggle>
              <Toggle
                pressed={editor.isActive('link')}
                onPressedChange={() => {
                  const url = window.prompt('Enter URL:');
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }}
                size="sm"
                disabled={sending}
              >
                <LinkIcon className="h-4 w-4" />
              </Toggle>
            </div>
            {/* Editor */}
            <div className="border border-t-0 border-border rounded-b-md min-h-[300px] bg-background">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
