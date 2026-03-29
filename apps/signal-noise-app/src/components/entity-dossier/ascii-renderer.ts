import { Entity, PerplexityIntelligence, PersonIntelligence, formatValue } from './types'

export class ASCIIDossierRenderer {
  private static wrapText(text: string, width: number = 70): string {
    if (!text || text === 'N/A') return 'N/A'
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    words.forEach(word => {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word
      } else {
        lines.push(currentLine)
        currentLine = word
      }
    })
    
    if (currentLine) lines.push(currentLine)
    return lines.join('\n' + ' '.repeat(37))
  }
  
  private static drawProgressBar(score: number, maxScore: number = 100, width: number = 30): string {
    const filled = Math.round((score / maxScore) * width)
    const empty = width - filled
    return '█'.repeat(filled) + '░'.repeat(empty)
  }
  
  private static createHeader(title: string, subtitle?: string): string {
    const width = 77
    const titleLine = ` ${title} `
    const padding = Math.max(0, width - titleLine.length - 2)
    const leftPad = Math.floor(padding / 2)
    const rightPad = padding - leftPad
    
    let header = `╔${'═'.repeat(width)}╗\n`
    header += `║${' '.repeat(leftPad)}${titleLine}${' '.repeat(rightPad)}║\n`
    
    if (subtitle) {
      const subLine = ` ${subtitle} `
      const subPad = Math.max(0, width - subLine.length - 2)
      const leftSubPad = Math.floor(subPad / 2)
      const rightSubPad = subPad - leftSubPad
      header += `╠${'═'.repeat(width)}╣\n`
      header += `║${' '.repeat(leftSubPad)}${subLine}${' '.repeat(rightSubPad)}║\n`
    }
    
    header += `╠${'═'.repeat(width)}╣`
    return header
  }
  
  private static createSection(title: string): string {
    const width = 77
    const titleLine = ` ${title} `
    const padding = Math.max(0, width - titleLine.length - 2)
    const leftPad = Math.floor(padding / 2)
    const rightPad = padding - leftPad
    
    return `║${' '.repeat(leftPad)}${titleLine}${' '.repeat(rightPad)}║\n╠${'═'.repeat(width)}╣`
  }
  
  private static createFooter(): string {
    return `╚${'═'.repeat(77)}╝`
  }
  
  static renderClubDossier(entity: Entity, perplexityData?: PerplexityIntelligence): string {
    const props = entity.properties
    const width = 77
    let dossier = ''
    
    // Header
    dossier += this.createHeader(`⚽ ${props.name || 'CLUB'} ⚽`, 'Football Intelligence Dossier')
    dossier += '\n'
    
    // Core Information
    dossier += `║ Type: Club | League: ${formatValue(props.league)} | Founded: ${formatValue(props.founded)}                   ║\n`
    dossier += `║ HQ: ${formatValue(props.headquarters)} | Stadium: ${formatValue(props.stadium)}                       ║\n`
    dossier += `║ Website: ${props.website || 'N/A'} | Size: ${formatValue(props.companySize)}          ║\n`
    dossier += `╠${'═'.repeat(width)}╣\n`
    
    // Digital & Transformation
    dossier += this.createSection('DIGITAL & TRANSFORMATION')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    dossier += `║ Partner: ${formatValue(props.digitalPartner) || 'NTT DATA'}                                                     ║\n`
    dossier += `║ Digital Maturity: ${this.drawProgressBar(parseInt(formatValue(props.digitalMaturity)) || 0, 100, 25)} ${formatValue(props.digitalMaturity) || '0'}/100                           ║\n`
    dossier += `║ Transformation Score: ${this.drawProgressBar(parseInt(formatValue(props.digitalScore)) || 0, 100, 25)} ${formatValue(props.digitalScore) || '0'}/100                           ║\n`
    dossier += `║ Website Modernness: ${this.drawProgressBar(parseInt(formatValue(props.websiteModernness)) || 0, 10, 25)} ${formatValue(props.websiteModernness) || '0'}/10                              ║\n`
    dossier += `║ Weakness: ${formatValue(props.digitalWeakness) || 'Vendor lock-in via NTT DATA'}                                 ║\n`
    dossier += `║ Opportunities:                                                        ║\n`
    
    const opportunities = Array.isArray(props.digitalOpportunities) 
      ? props.digitalOpportunities 
      : [formatValue(props.digitalOpportunities)].filter(Boolean)
    
    opportunities.slice(0, 4).forEach(opp => {
      dossier += `║  • ${this.wrapText(opp, 66)}                                                   ║\n`
    })
    
    // Perplexity Intelligence Section
    if (perplexityData) {
      dossier += `╠${'═'.repeat(width)}╣\n`
      dossier += this.createSection('PERPLEXITY DEEP RESEARCH INTELLIGENCE')
      dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
      
      if (perplexityData.financialPerformance) {
        dossier += `║ 📈 FINANCIAL PERFORMANCE & MARKET POSITION (Last 12 Months)                                    ║\n`
        dossier += `║ • Revenue: ${perplexityData.financialPerformance.revenue}                                         ║\n`
        dossier += `║ • Commercial Growth: ${perplexityData.financialPerformance.growth}                                ║\n`
        dossier += `║ • Market Cap: ${perplexityData.financialPerformance.marketCap}                                   ║\n`
        dossier += `║                                                                                                  ║\n`
      }
      
      if (perplexityData.competitiveAnalysis) {
        dossier += `║ 🏆 COMPETITIVE PERFORMANCE & STRATEGIC DIRECTION                                               ║\n`
        dossier += `║ • Position: ${perplexityData.competitiveAnalysis.position}                                       ║\n`
        dossier += `║ • Strategic Focus: ${perplexityData.competitiveAnalysis.focus}                                   ║\n`
        dossier += `║                                                                                                  ║\n`
      }
      
      if (perplexityData.technologyInitiatives) {
        dossier += `║ 💡 TECHNOLOGY & DIGITAL TRANSFORMATION INITIATIVES                                              ║\n`
        dossier += `║ • Digital Strategy: ${perplexityData.technologyInitiatives.digitalStrategy}                      ║\n`
        dossier += `║ • Recent Investment: ${perplexityData.technologyInitiatives.innovations[0] || 'N/A'}             ║\n`
        dossier += `║                                                                                                  ║\n`
      }
    }
    
    // AI Reasoner Feedback
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('AI REASONER FEEDBACK')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    const defaultAnalysis = `${props.name}'s digital structure is mature but rigid. Their reliance on NTT DATA constrains innovation velocity. To engage, lead with a proof-of-value pilot that fits the gap NTT cannot move quickly enough to close.`
    dossier += `║ ${this.wrapText(props.aiAnalysis || defaultAnalysis)} ║\n`
    dossier += '\n║                                                                                                  ║\n'
    dossier += `║ Recommended Action: ${this.wrapText(props.recommendedAction || "Lead with a proof of value in community, youth, and women's sports digital transformation, backed by measurable ROI.")} ║\n`
    
    // Strategic Opportunities
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('STRATEGIC OPPORTUNITIES')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    
    const opportunities2 = [
      `🟢 Launch: "Digital Twin of the Emirates" (interactive data portal)`,
      `🟠 Partner with Arsenal Women for bilingual fan content testing`,
      `🟣 Offer AI-powered RFP tracking dashboard as white-label pilot`
    ]
    
    opportunities2.forEach(opp => {
      dossier += `║ ${this.wrapText(opp, 66)}                                                       ║\n`
    })
    
    // Key Personnel
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('KEY PERSONNEL')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    
    const personnel = Array.isArray(props.keyPersonnel) ? props.keyPersonnel : [formatValue(props.keyPersonnel)].filter(Boolean)
    personnel.slice(0, 6).forEach(person => {
      dossier += `║  • ${person} → [VIEW DOSSIER]                                                     ║\n`
    })
    
    // Recent News
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('LATEST NEWS')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    
    const news = [
      `[2025-09-28] Arsenal and Emirates renew sustainability partnership`,
      `[2025-09-10] Arsenal Women reach record 17,000 season ticket sales`,
      `[2025-08-22] Club launches "Arsenal Mind" mental health campaign`
    ]
    
    news.forEach(item => {
      dossier += `║ ${this.wrapText(item, 66)}                                                       ║\n`
    })
    
    // League Context
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('PREMIER LEAGUE SNAPSHOT')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    dossier += `║ Pos | Club        | Pts | GD | Form                                  ║\n`
    dossier += `║ ----|--------------|-----|----|--------------------------------------║\n`
    dossier += `║   1 | Man City     | 19  | +15 | W W W W D                           ║\n`
    dossier += `║   2 | Arsenal      | 17  | +10 | W D W W W                           ║\n`
    dossier += `║   3 | Liverpool    | 16  | +8  | W W D W W                           ║\n`
    
    // Footer
    dossier += '\n' + this.createFooter()
    
    return dossier
  }
  
  static renderPersonDossier(entity: Entity, perplexityData?: PersonIntelligence): string {
    const props = entity.properties
    const width = 77
    let dossier = ''
    
    // Header
    dossier += this.createHeader(`👤 ${props.name || 'PERSON'} — ${props.role || 'PROFESSIONAL'}`, 'Decision Maker Intelligence Dossier')
    dossier += '\n'
    
    // Core Information
    dossier += `║ Organization: ${formatValue(props.organization)} | Since: ${formatValue(props.since)} | Location: ${formatValue(props.location)}   ║\n`
    dossier += `║ Past Roles: ${formatValue(props.pastRoles) || 'N/A'}          ║\n`
    dossier += `╠${'═'.repeat(width)}╣\n`
    
    // Responsibilities
    dossier += this.createSection('RESPONSIBILITIES')
    props.responsibilities?.slice(0, 4).forEach(resp => {
      dossier += `║  • ${this.wrapText(resp, 66)}                                                       ║\n`
    })
    
    // Influence Level
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += `║ INFLUENCE LEVEL: ${props.influenceLevel || 'HIGH'}                                              ║\n`
    dossier += `║ DECISION SCOPE: ${formatValue(props.decisionScope)}       ║\n`
    dossier += `║ RELATION MAPPING: ${formatValue(props.relationMapping)}  ║\n`
    
    // Perplexity Intelligence
    if (perplexityData?.careerBackground) {
      dossier += `╠${'═'.repeat(width)}╣\n`
      dossier += this.createSection('PERPLEXITY DEEP RESEARCH INTELLIGENCE')
      dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
      dossier += `║ 📈 CAREER BACKGROUND & EXPERTISE                                                              ║\n`
      dossier += `║ • Previous Roles: ${perplexityData.careerBackground.previousRoles.join(', ')}               ║\n`
      dossier += `║ • Education: ${perplexityData.careerBackground.education}                                  ║\n`
      dossier += `║ • Recognition: ${perplexityData.careerBackground.recognition.join(', ')}                  ║\n`
    }
    
    // AI Communication Analysis
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('AI COMMUNICATION ANALYSIS')
    dossier += '\n║ ───────────────────────────────────────────────────────────────────── ║\n'
    dossier += `║ Tone: ${props.communicationTone || 'Professional, outcome-driven, values storytelling'}            ║\n`
    dossier += `║ Risk Profile: ${props.riskProfile || 'Low-risk, pragmatic; prefers case-study evidence'}     ║\n`
    dossier += `║ Outreach Strategy: ${props.outreachStrategy || 'Lead with insight → propose pilot → debrief'}     ║\n`
    
    // Strategic Hooks
    dossier += `╠${'═'.repeat(width)}╣\n`
    dossier += this.createSection('STRATEGIC HOOKS (AI-GENERATED)')
    props.strategicHooks?.slice(0, 3).forEach(hook => {
      dossier += `║  • ${this.wrapText(hook, 66)}                                                       ║\n`
    })
    
    // Footer
    dossier += '\n' + this.createFooter()
    
    return dossier
  }
}
