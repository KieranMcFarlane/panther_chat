'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { 
  useCopilotAction, 
  useCopilotReadable 
} from '@copilotkit/react-core'
import { useAGUIEventHandlers } from '@/hooks/useAGUIEvents'
import { useEmailVersionHistory } from '@/hooks/useEmailVersionHistory'
import TiptapEditor from '@/components/compose/TiptapEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  byteRoverEmailIntegration, 
  type ContactIntelligence 
} from '@/lib/byterover-email-integration'

import { 
  ArrowLeft, 
  Send, 
  Save, 
  Paperclip, 
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  History
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isLoading?: boolean
}

export default function ComposePage() {
  const router = useRouter()

  // Core email state
  const [subject, setSubject] = useState('')
  const [to, setTo] = useState('')
  const [content, setContent] = useState('')

  // Version history
  const versionHistory = useEmailVersionHistory()

  // ByteRover contact intelligence
  const [contactIntelligence, setContactIntelligence] = useState<ContactIntelligence | null>(null)
  const [isLoadingContact, setIsLoadingContact] = useState(false)
  const [emailSuggestions, setEmailSuggestions] = useState<any>(null)

  // Sales pipeline state
  const [messageThread, setMessageThread] = useState<Array<{
    id: string
    sender: string
    content: string
    timestamp: string
    direction: 'inbound' | 'outbound'
  }>>([])
  const [salesPipelineStage, setSalesPipelineStage] = useState<{
    stage: 'initial' | 'qualification' | 'discovery' | 'proposal' | 'negotiation' | 'closing' | 'followup'
    confidence: number
    nextAction: string
    riskFactors: string[]
    opportunityScore: number
  } | null>(null)
  const [isAnalyzingPipeline, setIsAnalyzingPipeline] = useState(false)

  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [chatStatus, setChatStatus] = useState<string>('')

  // UI flags
  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ---------- Helpers ----------

  const getPipelineStageIndex = (stage: string): number => {
    const stages = ['initial', 'qualification', 'discovery', 'proposal', 'negotiation', 'closing', 'followup']
    return stages.indexOf(stage)
  }

  // ---------- Sales Pipeline Analysis ----------

  const analyzeSalesPipeline = async (thread: typeof messageThread) => {
    if (thread.length === 0) return null
    setIsAnalyzingPipeline(true)

    try {
      const response = await fetch('/api/analyze-sales-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageThread: thread,
          currentEmailContent: content,
          recipient: to
        })
      })

      if (!response.ok) throw new Error('Failed to analyze pipeline')
      const analysis = await response.json()
      setSalesPipelineStage(analysis)
      return analysis
    } catch (error) {
      console.error('Pipeline analysis error:', error)
      return null
    } finally {
      setIsAnalyzingPipeline(false)
    }
  }

  useEffect(() => {
    if (messageThread.length === 0) return
    const timer = setTimeout(() => {
      analyzeSalesPipeline(messageThread)
    }, 1500)
    return () => clearTimeout(timer)
  }, [messageThread, to, content])

  // ---------- ByteRover Contact Intelligence ----------

  useEffect(() => {
    if (!to || !to.includes('@')) return

    const timer = setTimeout(async () => {
      try {
        setIsLoadingContact(true)
        const intelligence = await byteRoverEmailIntegration.getContactIntelligence(to)
        setContactIntelligence(intelligence || null)

        if (intelligence) {
          const suggestions = await byteRoverEmailIntegration.getEmailSuggestions(to, {
            currentContent: content,
            goal: 'continue conversation',
            tone: 'professional'
          })

          setEmailSuggestions(suggestions)

          setChatMessages(prev => [
            ...prev,
            {
              id: `contact_intel_${Date.now()}`,
              role: 'assistant',
              content: `🧠 *Contact Intelligence Loaded*\n\n**${intelligence.name || intelligence.email}**\n• Organization: ${intelligence.organization || 'Not specified'}\n• Goals: ${intelligence.goals?.slice(0, 2).join(', ') || 'Not identified'}\n• Last Contact: ${intelligence.lastContact || 'No history'}\n• Opportunity Score: ${intelligence.opportunityScore || 'N/A'}/100\n\nI've personalized your email suggestions based on this intelligence!`
            }
          ])
        }
      } catch (err) {
        console.error('ByteRover intelligence error:', err)
      } finally {
        setIsLoadingContact(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [to])

  // ---------- Version History ----------

  useEffect(() => {
    if (to && to.includes('@')) {
      versionHistory.loadHistory(undefined, to, subject)
    }
  }, [to, subject])

  useEffect(() => {
    if (!to || !content.trim()) return

    const timer = setTimeout(() => {
      versionHistory.saveVersion({
        toEmail: to,
        subject,
        content,
        changeType: 'user_edit',
        changeDescription: 'Auto-saved email content',
        metadata: { autoSave: true, timestamp: new Date().toISOString() }
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [to, subject, content])

  // ---------- AG-UI Events (for monitoring Claude Agent) ----------

  const { events, isProcessing } = useAGUIEventHandlers({
    onAgentStart: (event) => {
      console.log('🚀 AI Agent started (compose):', event.data)
      setChatMessages(prev => [
        ...prev,
        {
          id: `agent_start_${Date.now()}`,
          role: 'assistant',
          content: '🔍 *Researching relevant information for your email...*'
        }
      ])
    },
    onAgentToolUse: (event) => {
      console.log('🔧 AI Agent tool use (compose):', event.data.tool)
      setChatMessages(prev => [
        ...prev,
        {
          id: `tool_${Date.now()}`,
          role: 'assistant',
          content: `🔧 *Using ${event.data.tool || 'tools'} to enhance your email...*`
        }
      ])
    },
    onAgentToolResult: (event) => {
      console.log('✅ AI Agent tool result (compose):', event.data.tool)
      setChatMessages(prev => [
        ...prev,
        {
          id: `tool_result_${Date.now()}`,
          role: 'assistant',
          content: `✅ *Found useful information via ${event.data.tool || 'research'}*`
        }
      ])
    },
    onAgentMessage: (event) => {
      console.log('💬 AI Agent message (compose):', event.data.content)
    }
  })

  // ---------- Copilot Readable State ----------

  useCopilotReadable({
    description:
      'Current email composition state with ByteRover contact intelligence, sales pipeline intelligence and real-time editing capabilities.',
    value: {
      subject,
      to,
      content,
      action: 'composing_email',
      lastAction: 'composing_email',
      chatMessages: chatMessages.map(msg => ({ role: msg.role, content: msg.content })),
      messageThread,
      salesPipelineStage,
      contactIntelligence,
      emailSuggestions,
      messageThreadLength: messageThread.length,
      availableActions: {
        updateEmailContent: 'Directly updates subject, to, and content fields',
        improveWriting: 'Improves tone and style with specified tone and goal',
        generateSubject: 'Creates subject line from content',
        addCallToAction: 'Adds call to action based on type',
        researchEntity: 'Researches sports entities using MCP tools',
        personalizeForEntity: 'Personalizes content for specific entities',
        analyzePipeline: 'Analyzes message thread to determine sales pipeline stage',
        suggestNextStep: 'Provides pipeline-aware next steps and recommendations',
        personalizeWithMemory: 'Creates personalized email using ByteRover contact intelligence'
      },
      salesContext: salesPipelineStage
        ? {
            stage: salesPipelineStage.stage,
            confidence: salesPipelineStage.confidence,
            nextAction: salesPipelineStage.nextAction,
            opportunityScore: salesPipelineStage.opportunityScore,
            riskFactors: salesPipelineStage.riskFactors
          }
        : 'No pipeline analysis available',
      byteRoverContext: contactIntelligence
        ? {
            hasIntelligence: true,
            contactName: contactIntelligence.name || contactIntelligence.email,
            organization: contactIntelligence.organization,
            goals: contactIntelligence.goals,
            businessContext: contactIntelligence.businessContext,
            communicationStyle: contactIntelligence.communicationStyle,
            opportunityScore: contactIntelligence.opportunityScore,
            lastContact: contactIntelligence.lastContact,
            interactionHistory: contactIntelligence.interactionHistory
          }
        : 'No ByteRover intelligence available',
      emailSuggestions: emailSuggestions || 'No email suggestions yet'
    }
  })

  // ---------- Copilot Actions (now simple, no diff / buffering) ----------

  const applyEmailUpdate = useCallback(
    async ({ subject: newSubject, to: newTo, content: newContent }: { subject?: string; to?: string; content?: string }) => {
      if (newSubject) setSubject(newSubject)
      if (newTo) setTo(newTo)
      if (newContent) setContent(newContent)

      if ((newSubject || newContent) && to) {
        await versionHistory.saveVersion({
          toEmail: newTo || to,
          subject: newSubject || subject,
          content: newContent || content,
          changeType: 'ai_suggestion',
          changeDescription: 'AI-updated email content',
          metadata: { aiGenerated: true, timestamp: new Date().toISOString() }
        })
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: `update_done_${Date.now()}`,
          role: 'assistant',
          content: '✅ *Updated your email with AI suggestions.*'
        }
      ])

      return 'Email updated'
    },
    [to, subject, content, versionHistory]
  )

  useCopilotAction({
    name: 'updateEmailContent',
    description: 'Update the email content with AI assistance.',
    parameters: {
      subject: 'string for email subject line',
      to: 'string for recipient email address',
      content: 'string for email body content'
    },
    handler: async ({ subject: s, to: t, content: c }) => {
      return applyEmailUpdate({ subject: s, to: t, content: c })
    }
  })

  useCopilotAction({
    name: 'improveWriting',
    description: 'Improve the writing of the current email content',
    parameters: {
      tone: 'string describing desired tone (professional, friendly, formal, casual)',
      goal: 'string describing the goal of the email'
    },
    handler: async ({ tone, goal }) => {
      console.log('ImproveWriting called with:', { tone, goal })
      // Claude should typically call updateEmailContent afterwards.
      return 'Use updateEmailContent to apply improved writing.'
    }
  })

  useCopilotAction({
    name: 'generateSubject',
    description: 'Generate an email subject based on the content',
    parameters: {
      content: 'string containing the email body content'
    },
    handler: async ({ content: emailContent }) => {
      const generatedSubject = `Re: ${emailContent.slice(0, 40)}...`
      setSubject(generatedSubject)
      return generatedSubject
    }
  })

  useCopilotAction({
    name: 'addCallToAction',
    description: 'Add a call to action to the email',
    parameters: {
      ctaType: 'string describing the type of call to action (meeting, reply, purchase, etc.)'
    },
    handler: async ({ ctaType }) => {
      const ctaText =
        ctaType === 'meeting'
          ? '\n\nWould you be open to a 20-minute call next week to discuss this further?'
          : '\n\nLooking forward to hearing from you soon.'
      setContent(prev => (prev || '') + ctaText)
      return 'CTA added'
    }
  })

  useCopilotAction({
    name: 'suggestNextStep',
    description: 'Provides sales pipeline-aware suggestions for the next email step',
    parameters: {
      pipelineStage: 'string - current sales pipeline stage',
      goal: 'string - specific goal for this email',
      tone: 'string - desired tone (professional, friendly, urgent, etc.)'
    },
    handler: async ({ pipelineStage, goal, tone }) => {
      const suggestions = {
        initial: {
          professional:
            'Focus on building credibility and establishing initial interest. Include brief company overview and clear value proposition.',
          friendly: 'Share a relevant industry insight or personal connection point before discussing business.',
          urgent: 'Highlight a time-sensitive opportunity or market trend that needs attention.'
        },
        qualification: {
          professional: 'Ask targeted questions about their current challenges and decision-making process.',
          friendly: 'Share relevant case studies or success stories that resonate with their situation.',
          urgent: 'Emphasize competitive advantages of addressing their needs now.'
        },
        discovery: {
          professional: 'Propose a discovery call to discuss specific requirements and solutions.',
          friendly: 'Offer to share insights from similar organizations in their industry.',
          urgent: 'Address pressing business challenges and how you can help resolve them quickly.'
        },
        proposal: {
          professional: 'Present clear, structured proposal with ROI justification and implementation timeline.',
          friendly: 'Frame proposal as a partnership opportunity with mutual benefits.',
          urgent: 'Highlight limited-time offer or competitive pricing advantage.'
        },
        negotiation: {
          professional: 'Address concerns with data-driven responses and flexible terms.',
          friendly: 'Emphasize long-term partnership value and relationship building.',
          urgent: 'Create a sense of opportunity cost for delayed decision.'
        },
        closing: {
          professional: 'Outline next steps for implementation and onboarding.',
          friendly: 'Express excitement about the partnership.',
          urgent: 'Clarify deadline and confirm final details.'
        },
        followup: {
          professional: 'Provide value-added content or insights relevant to their ongoing needs.',
          friendly: 'Maintain relationship through helpful updates.',
          urgent: 'Address new opportunities or challenges that have emerged.'
        }
      }

      const stageSuggestions =
        suggestions[pipelineStage as keyof typeof suggestions] || suggestions.discovery
      const specificSuggestion =
        stageSuggestions[tone as keyof typeof stageSuggestions] || stageSuggestions.professional

      setChatMessages(prev => [
        ...prev,
        {
          id: `pipeline_suggestion_${Date.now()}`,
          role: 'assistant',
          content: `🎯 *Pipeline-Aware Suggestion*\n\n**Recommended Approach:** ${specificSuggestion}\n\n**Context:**\n• Stage: ${pipelineStage}\n• Goal: ${goal}\n• Opportunity Score: ${
            salesPipelineStage?.opportunityScore || 'N/A'
          }/100\n\nAsk me to draft an email based on this guidance.`
        }
      ])

      return `Suggestion provided for ${pipelineStage}`
    }
  })

  useCopilotAction({
    name: 'personalizeWithMemory',
    description: 'Create personalized email content using ByteRover contact intelligence',
    parameters: {
      goal: 'string - specific goal for this email',
      tone: 'string - desired tone',
      context: 'string - additional context'
    },
    handler: async ({ goal, tone, context }) => {
      if (!contactIntelligence) {
        setChatMessages(prev => [
          ...prev,
          {
            id: `no_memory_${Date.now()}`,
            role: 'assistant',
            content:
              "🔍 *No stored contact intelligence for this recipient yet. I'll still help you craft a thoughtful email.*"
          }
        ])
        return 'No contact memory, but will still help.'
      }

      const greeting = contactIntelligence.organization
        ? `Dear ${contactIntelligence.name || 'team'} at ${contactIntelligence.organization},`
        : `Dear ${contactIntelligence.name || contactIntelligence.email},`

      const goalLine = contactIntelligence.goals?.length
        ? `Based on your focus around ${contactIntelligence.goals[0]}, I wanted to reach out regarding ${goal}.`
        : `I wanted to reach out regarding ${goal}.`

      const valueLine = contactIntelligence.businessContext?.challenges?.length
        ? `Given the challenges you're facing in ${
            contactIntelligence.businessContext.industry || 'your sector'
          }, I believe we can help.`
        : `I believe we can offer meaningful support in this area.`

      const closing =
        salesPipelineStage?.stage === 'initial'
          ? 'Would you be open to a brief 15–20 minute call next week to explore this further?'
          : 'I look forward to continuing the conversation and exploring how we can work together.'

      const personalized = `
${greeting}

${goalLine}

${valueLine}

${context || ''}

${closing}

Best regards,
`.trim()

      if (!subject) {
        const s =
          contactIntelligence.goals?.[0]
            ? `Re: ${contactIntelligence.goals[0]} – ${goal}`
            : `${goal} – Opportunity`
        setSubject(s)
      }

      setContent(personalized)

      setChatMessages(prev => [
        ...prev,
        {
          id: `personalized_${Date.now()}`,
          role: 'assistant',
          content: `🧠 *Applied ByteRover contact memory to your email.*\n\nGoals: ${
            contactIntelligence.goals?.join(', ') || 'Not identified'
          }\nOrganization: ${
            contactIntelligence.organization || 'Individual'
          }\nIndustry: ${contactIntelligence.businessContext?.industry || 'N/A'}`
        }
      ])

      return 'Email personalized with memory'
    }
  })

  // ---------- Chat Sending (simple streaming, no diff/extra buffering) ----------

  const sendChatMessage = async (messageText: string) => {
    const trimmed = messageText.trim()
    if (!trimmed || isChatLoading) return

    const idBase = uuidv4()
    const userMessage: ChatMessage = {
      id: `user_${idBase}`,
      role: 'user',
      content: trimmed
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)
    setChatStatus('')

    const assistantId = `assistant_${idBase}`
    setChatMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        isLoading: true
      }
    ])

    // If user is clearly asking for email help, prepend email context
    const emailHelpPatterns = [
      'email',
      'improve this email',
      'make this email',
      'help me write',
      'professional email',
      'rewrite this email',
      'update email',
      'edit email',
      'make my email',
      'write an email',
      'draft an email'
    ]

    const isEmailHelp = emailHelpPatterns.some(p => trimmed.toLowerCase().includes(p))
    const messageContent = isEmailHelp
      ? `Email composition help request: ${trimmed}\n\nCurrent state:\nSubject: ${
          subject || 'None'
        }\nTo: ${to || 'None'}\nContent:\n${content || 'Empty'}`
      : trimmed

    try {
      const response = await fetch('/api/copilotkit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: {
            data: {
              messages: [
                {
                  id: userMessage.id,
                  textMessage: {
                    role: 'user',
                    content: messageContent
                  }
                }
              ],
              threadId: `compose_${to || 'generic'}`
            }
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body reader available')

      let buffer = ''
      let assistantContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          try {
            const chunk = JSON.parse(line.slice(6))
            console.log('📨 Received chunk:', chunk) // Debug logging

            switch (chunk.type) {
              case 'text': {
                if (!chunk.text) break
                console.log('📝 Adding text content:', chunk.text.substring(0, 100)) // Debug logging
                assistantContent += chunk.text
                setChatMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? { ...m, content: assistantContent, isLoading: false }
                      : m
                  )
                )
                break
              }
              case 'status': {
                setChatStatus(chunk.message || '')
                break
              }
              case 'tool_use': {
                console.log('Tool use:', chunk.tool)
                break
              }
              case 'final': {
                // nothing special needed, stream will end
                break
              }
              case 'error': {
                const msg = chunk.message || 'An error occurred while processing your request.'
                setChatMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? { ...m, content: `❌ ${msg}`, isLoading: false }
                      : m
                  )
                )
                break
              }
              default: {
                // ignore other custom types (agui-event, etc.) — AGUI hook already handles events
                break
              }
            }
          } catch (err) {
            console.error('Error parsing chunk:', err)
          }
        }
      }

      console.log('🔍 Final assistant content length:', assistantContent.length) // Debug logging
      console.log('🔍 Final assistant content:', assistantContent.substring(0, 200)) // Debug logging
      
      if (!assistantContent) {
        console.log('⚠️ No assistant content received, showing fallback') // Debug logging
        setChatMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "I'm here to help with your email. Try: “Improve the tone”, “Suggest a subject”, or “Summarise this email.”",
                  isLoading: false
                }
              : m
          )
        )
      }
    } catch (error: any) {
      console.error('Chat error:', error)
      const msg =
        error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_EMPTY_RESPONSE')
          ? 'Network issue – please check your connection and try again.'
          : `Sorry, I encountered an error: ${error?.message || 'Unknown error'}`

      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? { ...m, content: msg, isLoading: false } : m
        )
      )
    } finally {
      setIsChatLoading(false)
      setChatStatus('')
    }
  }

  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage(chatInput)
    }
  }

  // ---------- Send / Save ----------

  const handleSend = async () => {
    if (!subject || !to || !content) {
      alert('Please fill in To, Subject and Content')
      return
    }

    setIsSending(true)
    try {
      await byteRoverEmailIntegration.storeEmailInteraction(to, {
        subject,
        content,
        direction: 'sent',
        aiAnalysis: {
          pipelineStage: salesPipelineStage?.stage || 'initial',
          opportunityScore: salesPipelineStage?.opportunityScore || 0,
          contactIntelligence: contactIntelligence
            ? {
                goals: contactIntelligence.goals,
                organization: contactIntelligence.organization,
                opportunityScore: contactIntelligence.opportunityScore
              }
            : null
        }
      })

      if (contactIntelligence && salesPipelineStage) {
        await byteRoverEmailIntegration.storeContactInsights(to, {
          goals: contactIntelligence.goals,
          businessContext: contactIntelligence.businessContext,
          communicationStyle: contactIntelligence.communicationStyle,
          opportunities: [`Pipeline stage: ${salesPipelineStage.stage}`],
          risks: salesPipelineStage.riskFactors
        })
      }

      // TODO: actual email sending implementation
      console.log('Sending email:', { subject, to, content })

      setChatMessages(prev => [
        ...prev,
        {
          id: `send_success_${Date.now()}`,
          role: 'assistant',
          content: `✅ *Email sent & stored in ByteRover.*\n\nPipeline: ${
            salesPipelineStage?.stage || 'initial'
          }\nOpportunity: ${salesPipelineStage?.opportunityScore || 0}/100`
        }
      ])

      alert('Email sent successfully!')
      router.push('/mailbox')
    } catch (error) {
      console.error('Failed to send email:', error)
      alert('Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: implement save to drafts
      console.log('Saving draft:', { subject, to, content })
      alert('Draft saved!')
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------- JSX ----------

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/mailbox')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Mailbox
            </Button>
            <div>
              <h1 className="text-xl font-semibold">New Message</h1>
              <p className="text-sm text-muted-foreground">AI-powered email composer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>

            {versionHistory.state.versions.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const success = await versionHistory.undo()
                    if (success) {
                      setChatMessages(prev => [
                        ...prev,
                        {
                          id: `undo_${Date.now()}`,
                          role: 'assistant',
                          content: '↩️ *Reverted to previous version.*'
                        }
                      ])
                    }
                  }}
                  disabled={!versionHistory.canUndo || versionHistory.state.isLoading}
                  className="flex items-center gap-2"
                >
                  <Undo className="h-4 w-4" />
                  Undo
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const success = await versionHistory.redo()
                    if (success) {
                      setChatMessages(prev => [
                        ...prev,
                        {
                          id: `redo_${Date.now()}`,
                          role: 'assistant',
                          content: '↪️ *Redid to next version.*'
                        }
                      ])
                    }
                  }}
                  disabled={!versionHistory.canRedo || versionHistory.state.isLoading}
                  className="flex items-center gap-2"
                >
                  <Redo className="h-4 w-4" />
                  Redo
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setChatMessages(prev => [
                      ...prev,
                      {
                        id: `history_${Date.now()}`,
                        role: 'assistant',
                        content: `📚 *Version History*\n\n${versionHistory.state.versions
                          .slice(0, 5)
                          .map(
                            v =>
                              `v${v.version_number}: ${v.change_type} - ${new Date(
                                v.created_at
                              ).toLocaleTimeString()}`
                          )
                          .join('\n')}${
                          versionHistory.state.versions.length > 5
                            ? `\n...and ${
                                versionHistory.state.versions.length - 5
                              } more versions`
                            : ''
                        }`
                      }
                    ])
                  }}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  {versionHistory.state.versions.length}
                </Button>
              </>
            )}

            <Button onClick={handleSend} disabled={isSending} className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Main Editor Column */}
        <div className="flex-1 flex flex-col">
          {/* Email Fields */}
          <div className="border-b p-4 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium w-12">To:</label>
              <Input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium w-12">Subject:</label>
              <Input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject"
                className="flex-1"
              />
            </div>
          </div>

          {/* ByteRover Contact Panel */}
          {contactIntelligence && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 mb-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" />
                  Contact Intelligence from ByteRover
                </h4>
                <div className="flex items-center gap-2">
                  {contactIntelligence.opportunityScore && (
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      Score: {contactIntelligence.opportunityScore}/100
                    </span>
                  )}
                  <div className="w-12 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${contactIntelligence.opportunityScore || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {contactIntelligence.organization && (
                  <div>
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      Organization:
                    </span>
                    <p className="text-gray-700 dark:text-gray-300">
                      {contactIntelligence.organization}
                    </p>
                  </div>
                )}

                {contactIntelligence.goals?.length > 0 && (
                  <div>
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      Goals:
                    </span>
                    <p className="text-gray-700 dark:text-gray-300">
                      {contactIntelligence.goals.slice(0, 2).join(', ')}
                    </p>
                  </div>
                )}

                {contactIntelligence.lastContact && (
                  <div>
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      Last Contact:
                    </span>
                    <p className="text-gray-700 dark:text-gray-300">
                      {new Date(contactIntelligence.lastContact).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {contactIntelligence.businessContext?.industry && (
                  <div>
                    <span className="text-purple-700 dark:text-purple-300 font-medium">
                      Industry:
                    </span>
                    <p className="text-gray-700 dark:text-gray-300">
                      {contactIntelligence.businessContext.industry}
                    </p>
                  </div>
                )}
              </div>

              {emailSuggestions && (
                <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-700 dark:text-purple-300 font-medium text-xs">
                      💡 AI Subject Suggestions:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {emailSuggestions.subjectSuggestions?.slice(0, 3).map(
                      (suggestion: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => setSubject(suggestion)}
                          className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded transition-colors"
                        >
                          {suggestion}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isLoadingContact && (
            <div className="bg-purple-50 dark:bg-purple-950/20 p-3 mb-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" />
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Loading contact intelligence from ByteRover...
                </span>
              </div>
            </div>
          )}

          {/* Sales Pipeline Meter */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-4 mb-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                Sales Pipeline Progress
              </h4>
              {salesPipelineStage && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {salesPipelineStage.confidence}% confidence
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${salesPipelineStage.opportunityScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-purple-600">
                    {salesPipelineStage.opportunityScore}/100
                  </span>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
              {salesPipelineStage && (
                <div
                  className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-1000 ease-out"
                  style={{
                    width: `${((getPipelineStageIndex(salesPipelineStage.stage) + 1) / 7) * 100}%`
                  }}
                />
              )}

              <div className="relative flex justify-between">
                {[
                  { id: 'initial', label: 'Initial', icon: '📧' },
                  { id: 'qualification', label: 'Qualify', icon: '🎯' },
                  { id: 'discovery', label: 'Discover', icon: '🔍' },
                  { id: 'proposal', label: 'Proposal', icon: '📄' },
                  { id: 'negotiation', label: 'Negotiate', icon: '🤝' },
                  { id: 'closing', label: 'Close', icon: '✅' },
                  { id: 'followup', label: 'Follow Up', icon: '🔄' }
                ].map((stage, index) => {
                  const isActive = salesPipelineStage?.stage === stage.id
                  const isCompleted = salesPipelineStage
                    ? getPipelineStageIndex(salesPipelineStage.stage) > index
                    : false

                  return (
                    <div key={stage.id} className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 border-2
                          ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-600 scale-110 shadow-lg'
                              : isCompleted
                              ? 'bg-green-500 text-white border-green-600'
                              : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-600'
                          }`}
                      >
                        {stage.icon}
                      </div>
                      <span
                        className={`text-xs mt-2 font-medium transition-colors duration-300
                          ${
                            isActive
                              ? 'text-purple-700 dark:text-purple-300'
                              : isCompleted
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {salesPipelineStage && (
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Current Stage:{' '}
                  <span className="font-medium text-purple-600 dark:text-purple-400">
                    {salesPipelineStage.stage.toUpperCase()}
                  </span>
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300">
                  {salesPipelineStage.nextAction}
                </p>
                {salesPipelineStage.riskFactors.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-red-600 dark:text-red-400">
                      ⚠️ {salesPipelineStage.riskFactors.length} risk factor(s) detected
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tiptap Editor */}
          <div className="flex-1 overflow-hidden">
            <TiptapEditor
              content={content}
              onChange={setContent}
              placeholder="Start writing your email... Ask the AI to help you compose, edit, or improve your message."
            />
          </div>

          {/* Bottom Toolbar */}
          <div className="border-t p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  AI Assistant Ready
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Ask: "Help me write a professional email" or "Improve the tone"
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="w-80 border-l bg-muted/50">
          <div className="p-4 h-full flex flex-col">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isProcessing ? 'bg-green-500 animate-pulse' : 'bg-green-500'
                }`}
              />
              AI Assistant
            </h3>
            <div className="text-sm text-muted-foreground mb-2">
              Ask me to help you write or improve your email.
            </div>
            {chatStatus && (
              <div className="text-xs text-blue-600 mb-2 whitespace-pre-line">{chatStatus}</div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-4 min-h-[200px] max-h-[300px]">
              {chatMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <div className="mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      🤖
                    </div>
                  </div>
                  <p className="text-sm">I can help you with:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    <li>• Writing professional emails</li>
                    <li>• Improving tone and clarity</li>
                    <li>• Suggesting subject lines</li>
                    <li>• Adding calls-to-action</li>
                    <li>• Grammar and style checks</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-full px-3 py-2 rounded-lg text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-background border text-foreground'
                        } ${msg.isLoading ? 'animate-pulse' : ''}`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t pt-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyPress}
                  placeholder="Ask for help with your email..."
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  disabled={isChatLoading}
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-md transition-colors"
                >
                  {isChatLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
