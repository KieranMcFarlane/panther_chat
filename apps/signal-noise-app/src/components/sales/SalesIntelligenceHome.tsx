"use client"

import React, { useState } from "react";

import { Mail, Calendar as CalendarIcon, Newspaper, Lightbulb, Briefcase, Clock, ExternalLink, CheckCircle2, Circle, Star, StarOff, Plus, Search, Filter, BadgeCheck, Flame, Bell } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Input } from "@/components/ui/input";

import { Separator } from "@/components/ui/separator";

import { ScrollArea } from "@/components/ui/scroll-area";

// -----------------------------
// Types
// -----------------------------

type PipelineStage = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won";

type EmailItem = {
  id: string;
  title: string;
  subtitle: string;
  opened: boolean; // whether it has been opened
  receivedAt: string; // ISO timestamp
  from: string;
  tags?: string[];
  leadId?: string;
  stage?: PipelineStage;
  warmth?: number; // 0..100
  favourite?: boolean;
};

type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string; // ISO
  summary: string;
  url: string;
  tags?: string[];
};

type Opportunity = {
  id: string;
  title: string;
  confidence: number; // 0..1 from AI
  reason: string;
  cta?: string;
};

type RfpItem = {
  id: string;
  org: string;
  title: string;
  deadline: string; // ISO
  value?: string;
  url?: string;
};

type FactItem = {
  id: string;
  text: string;
  relevance: number; // 0..1
};

type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end?: string; // ISO
  type: "appointment" | "convention" | "budget";
  location?: string;
};

type Nudge = {
  id: string;
  text: string;
  reason: string;
  actionLabel: string;
  lead?: string;
  due?: string; // ISO
};

// -----------------------------
// Mock Data (replace with live data hooks)
// -----------------------------

const emailsSeed: EmailItem[] = [
  {
    id: "em1",
    title: "Arsenal FC — Website Revamp RFI",
    subtitle: "Can you share creds and a rough timeline?",
    opened: false,
    receivedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    from: "commercial@arsenal.co.uk",
    tags: ["RFI", "Premier League"],
    leadId: "arsenal",
    stage: "qualified",
    warmth: 72,
    favourite: true,
  },
  {
    id: "em2",
    title: "Wimbledon — Post‑Championships Digital Review",
    subtitle: "Let's book a workshop to scope 2026 roadmap.",
    opened: true,
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    from: "digital@aeltc.com",
    tags: ["Workshop", "Tennis"],
    leadId: "wimbledon",
    stage: "proposal",
    warmth: 63,
    favourite: true,
  },
  {
    id: "em3",
    title: "MLS Club — Fan Data Platform brief",
    subtitle: "We're exploring AI personalization for 24/25 season.",
    opened: false,
    receivedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    from: "cto@mlsclub.com",
    tags: ["AI", "RFP"],
    leadId: "mls",
    stage: "contacted",
    warmth: 38,
    favourite: false,
  },
];

const news: NewsItem[] = [
  {
    id: "n1",
    title: "Premier League clubs raise digital fan spend for 2026",
    source: "SportsBiz",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    summary:
      "Annual reports indicate increased allocations for web, apps, and data ops heading into next season.",
    url: "https://example.com/pl-digital-spend",
    tags: ["UK", "Budget", "Clubs"],
  },
  {
    id: "n2",
    title: "US leagues standardize RFP templates for fan experience tech",
    source: "VenueTech",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    summary:
      "New frameworks aim to speed up procurement cycles for venue and content platforms.",
    url: "https://example.com/us-leagues-rfp",
    tags: ["US", "RFP", "Procurement"],
  },
];

const opportunities: Opportunity[] = [
  {
    id: "o1",
    title: "Arsenal: CRO + checkout optimization for kit launch",
    confidence: 0.86,
    reason:
      "AI flagged summer kit‑launch revenue spike + site performance gaps; ideal for quick ROI pre‑season.",
    cta: "Draft proposal",
  },
  {
    id: "o2",
    title: "Wimbledon: Editorial tooling & headless CMS upgrade",
    confidence: 0.78,
    reason:
      "Post‑event window (Aug–Nov) identified; high content throughput and accessibility goals.",
    cta: "Book discovery",
  },
];

const rfps: RfpItem[] = [
  {
    id: "r1",
    org: "City Council",
    title: "Digital platform for community sports participation",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
    value: "£450k",
    url: "https://example.com/rfp-city",
  },
  {
    id: "r2",
    org: "National FA",
    title: "Content delivery network + live scoring API",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    value: "$1.2m",
    url: "https://example.com/rfp-fa",
  },
];

const facts: FactItem[] = [
  { id: "f1", text: "Feb–Mar often yield surplus spend for UK clubs.", relevance: 0.9 },
  { id: "f2", text: "US franchises plan major builds in Feb–Mar and Jun–Aug.", relevance: 0.85 },
  { id: "f3", text: "AELTC FY ends 30 June; post‑event digital window Aug–Nov.", relevance: 0.8 },
];

const calendar: CalendarEvent[] = [
  {
    id: "c1",
    title: "Discovery call — Arsenal",
    start: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
    type: "appointment",
    location: "Google Meet",
  },
  {
    id: "c2",
    title: "SportsBiz Europe — Expo Day",
    start: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    type: "convention",
    location: "Barcelona Fira",
  },
  {
    id: "c3",
    title: "UK Autumn Budget",
    start: new Date(new Date().getFullYear(), 10, 26, 9, 0, 0).toISOString(), // Nov 26, 9:00
    type: "budget",
    location: "UK Treasury",
  },
];

const nudges: Nudge[] = [
  {
    id: "nu1",
    text: "Ping Arsenal with kit‑launch CRO quick wins",
    reason: "No reply in 8 days • high conversion upside this quarter",
    actionLabel: "Send follow‑up",
    lead: "arsenal",
    due: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "nu2",
    text: "React to Wimbledon's post on accessibility",
    reason: "Topical to your CMS audit case study",
    actionLabel: "Draft comment",
    lead: "wimbledon",
    due: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "nu3",
    text: "Qualify MLS Club brief",
    reason: "RFP window opens next month • establish budget now",
    actionLabel: "Qualify lead",
    lead: "mls",
    due: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  },
];

// -----------------------------
// Helpers
// -----------------------------

const fmtTime = (iso: string) => {
  const date = new Date(iso);
  // Use 24-hour format to avoid AM/PM inconsistencies between server and client
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  // Use consistent locale and format to avoid hydration mismatches
  return d.toLocaleDateString('en-US', { weekday: "short", month: "short", day: "numeric" });
};

const confToBadge = (c: number) => (c >= 0.85 ? "High" : c >= 0.65 ? "Med" : "Low");

const eventTypeBadge: Record<CalendarEvent["type"], { label: string; className: string }> = {
  appointment: { label: "Meeting", className: "bg-blue-100 text-blue-700" },
  convention: { label: "Convention", className: "bg-violet-100 text-violet-700" },
  budget: { label: "Budget", className: "bg-amber-100 text-amber-800" },
};

const STAGES: PipelineStage[] = ["new", "contacted", "qualified", "proposal", "negotiation", "won"];
const stageLabel: Record<PipelineStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
};

const warmthEmoji = (w?: number) => {
  if (w === undefined) return "";
  if (w >= 75) return "🔥";
  if (w >= 50) return "🌤️";
  if (w > 0) return "🧊";
  return "";
};

// -----------------------------
// Components
// -----------------------------

function StageBar({ stage }: { stage?: PipelineStage }) {
  const idx = stage ? STAGES.indexOf(stage) : 0;
  return (
    <div className="flex items-center gap-1 mt-2">
      {STAGES.map((s, i) => (
        <div key={s} className={`h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} style={{ width: `${100 / STAGES.length}%` }} />
      ))}
    </div>
  );
}

function EmailRow({ item, onToggleFav }: { item: EmailItem; onToggleFav: (id: string) => void }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/60">
      <div className="mt-1 flex-shrink-0">
        {item.opened ? (
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Circle className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{item.title}</div>
            <div className="text-sm text-muted-foreground truncate mt-0.5">— {item.subtitle}</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {typeof item.warmth === "number" && (
              <div className="text-xs flex items-center gap-1 whitespace-nowrap"><Flame className="h-3.5 w-3.5" />{warmthEmoji(item.warmth)} {item.warmth}%</div>
            )}
            <button className="text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => onToggleFav(item.id)} aria-label="toggle favourite">
              {item.favourite ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
            </button>
            <div className="text-xs text-muted-foreground whitespace-nowrap">{fmtDay(item.receivedAt)} · {fmtTime(item.receivedAt)}</div>
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
          <span className="truncate">{item.from}</span>
          {item.tags?.map((t) => (
            <Badge key={t} variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap">{t}</Badge>
          ))}
          {item.stage && (
            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap">{stageLabel[item.stage]}</Badge>
          )}
        </div>
        <StageBar stage={item.stage} />
      </div>
    </div>
  );
}

function Inbox() {
  const [items, setItems] = useState<EmailItem[]>(emailsSeed);
  const toggleFav = (id: string) => setItems((prev) => prev.map((e) => (e.id === id ? { ...e, favourite: !e.favourite } : e)));
  const newCount = items.filter((e) => !e.opened).length;

  return (
    <Card className="shadow-sm bg-white/95 backdrop-blur-sm w-full overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 p-6">
        <CardTitle className="text-lg flex items-center gap-2 min-w-0"><Mail className="h-5 w-5 flex-shrink-0" /> <span className="truncate">Inbox</span> <span className="text-xs text-muted-foreground whitespace-nowrap">({newCount} new)</span></CardTitle>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search mail" className="pl-8 w-full sm:w-48" />
          </div>
          <Button variant="outline" size="sm" className="flex-shrink-0"><Filter className="h-4 w-4 mr-1 hidden sm:inline-block" />Filter</Button>
          <Button size="sm" className="flex-shrink-0"><Plus className="h-4 w-4 mr-1" />New</Button>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <ScrollArea className="h-[360px]">
          {items.map((e) => (
            <EmailRow key={e.id} item={e} onToggleFav={toggleFav} />
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function NewsPanel() {
  return (
    <Card className="shadow-sm bg-white/95 backdrop-blur-sm w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2"><Newspaper className="h-5 w-5" /> Industry News</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        <ScrollArea className="h-[260px]">
          {news.map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer" className="block p-4 hover:bg-muted/60">
              <div className="flex items-center justify-between">
                <div className="font-medium truncate">{n.title}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{fmtDay(n.publishedAt)}</div>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{n.summary}</div>
              <div className="mt-2 flex gap-2 items-center">
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">{n.source}</Badge>
                {n.tags?.map((t) => (
                  <Badge key={t} variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">{t}</Badge>
                ))}
                <ExternalLink className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </div>
            </a>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function OpportunitiesPanel() {
  return (
    <Card className="shadow-sm bg-white/95 backdrop-blur-sm w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2"><Lightbulb className="h-5 w-5" /> AI Opportunities</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="grid gap-3 p-4">
        {opportunities.map((o) => (
          <div key={o.id} className="p-4 rounded-xl border bg-card">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />
              <div className="font-medium">{o.title}</div>
              <Badge className="ml-auto rounded-full px-2 py-0.5 text-[10px]">{confToBadge(o.confidence)} • {(o.confidence * 100).toFixed(0)}%</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-2">{o.reason}</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary">{o.cta ?? "Open"}</Button>
              <Button size="sm" variant="outline">Save</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RfpsFactsTabs() {
  return (
    <Card className="shadow-sm bg-white/95 backdrop-blur-sm w-full overflow-hidden">
      <CardHeader className="pb-2 p-6">
        <CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5 flex-shrink-0" /> RFPs & Facts</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="p-6">
        <Tabs defaultValue="rfps" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="rfps" className="truncate">RFPs</TabsTrigger>
            <TabsTrigger value="facts" className="truncate">Relevant Facts</TabsTrigger>
          </TabsList>
          <TabsContent value="rfps" className="mt-4">
            <div className="grid gap-2">
              {rfps.map((r) => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border w-full">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.org} — {r.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="h-3.5 w-3.5 flex-shrink-0" />Deadline: {fmtDay(r.deadline)}</span>
                      {r.value && <span className="whitespace-nowrap">Value: {r.value}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {r.url && (
                      <Button size="sm" variant="outline" asChild className="flex-shrink-0">
                        <a href={r.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Open</a>
                      </Button>
                    )}
                    <Button size="sm" className="flex-shrink-0">Qualify</Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="facts" className="mt-4">
            <div className="grid gap-2">
              {facts.map((f) => (
                <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border w-full">
                  <Star className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">{f.text}</div>
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap flex-shrink-0">Relevance {(f.relevance * 100).toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SalesCalendar() {
  return (
    <Card className="shadow-sm bg-white/95 backdrop-blur-sm w-full overflow-hidden">
      <CardHeader className="pb-2 p-6">
        <CardTitle className="text-lg flex items-center gap-2"><CalendarIcon className="h-5 w-5 flex-shrink-0" /> Sales Calendar</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="p-6">
        <div className="grid gap-2">
          {calendar.map((ev) => (
            <div key={ev.id} className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 w-full">
              <Badge className={`${eventTypeBadge[ev.type].className} rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap flex-shrink-0`}>{eventTypeBadge[ev.type].label}</Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{ev.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {fmtDay(ev.start)} · {fmtTime(ev.start)}{ev.location ? ` • ${ev.location}` : ""}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" className="flex-shrink-0">Details</Button>
                <Button size="sm" className="flex-shrink-0">Book</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FocusPanel() {
  return (
    <Card className="shadow-sm bg-white/95 backdrop-blur-sm w-full overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5" /> Today's Focus</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="p-4 grid gap-3">
        {nudges.map((n) => (
          <div key={n.id} className="p-3 rounded-xl border">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">Lead: {n.lead}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">Due {fmtDay(n.due || new Date().toISOString())} · {fmtTime(n.due || new Date().toISOString())}</span>
            </div>
            <div className="mt-2 font-medium flex items-center gap-2"><Lightbulb className="h-4 w-4" />{n.text}</div>
            <div className="text-xs text-muted-foreground mt-1">{n.reason}</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm">{n.actionLabel}</Button>
              <Button size="sm" variant="outline">Snooze</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Page
// -----------------------------

export default function SalesIntelligenceHome() {
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto min-h-screen w-full overflow-x-hidden">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white truncate">Sales Intelligence</h1>
          <p className="text-sm text-gray-300 mt-1 break-words">AI Nudges • Opportunities • RFPs • News</p>
        </div>
        <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
          <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 sm:flex-initial">Customize</Button>
          <Button className="bg-yellow-500 text-black hover:bg-yellow-400 flex-1 sm:flex-initial">New Lead</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 w-full">
        <FocusPanel />
        <Tabs defaultValue="news" className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-3 overflow-hidden">
            <TabsTrigger value="news" className="truncate text-xs sm:text-sm">News</TabsTrigger>
            <TabsTrigger value="opps" className="truncate text-xs sm:text-sm">Opportunities</TabsTrigger>
            <TabsTrigger value="rfps" className="truncate text-xs sm:text-sm">RFPs & Facts</TabsTrigger>
          </TabsList>
          <TabsContent value="news" className="mt-4">
            <NewsPanel />
          </TabsContent>
          <TabsContent value="opps" className="mt-4">
            <OpportunitiesPanel />
          </TabsContent>
          <TabsContent value="rfps" className="mt-4">
            <RfpsFactsTabs />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

