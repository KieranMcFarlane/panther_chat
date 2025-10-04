/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'custom-bg': '#181E2C',
  			'custom-box': '#242834',
  			'custom-border': '#56596A',
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			'fm-yellow': '#FDCB58',
  			'fm-green': '#4ADE80',
  			'fm-orange': '#FB923C',
  			'fm-red': '#F87171',
  			'fm-white': '#FFFFFF',
  			'fm-off-white': '#F5F5F5',
  			'fm-light-grey': '#E0E0E0',
  			'fm-medium-grey': '#A0A0A0',
  			'fm-dark-grey': '#909090',
  			'fm-meta': '#888888',
  			'fm-meta-subtle': '#757575',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			header: [
  				'Bebas Neue',
  				'sans-serif'
  			],
  			subheader: [
  				'Satoshi-Bold',
  				'sans-serif'
  			],
  			'body-primary': [
  				'Satoshi-Regular',
  				'sans-serif'
  			],
  			'body-medium': [
  				'Satoshi-Medium',
  				'sans-serif'
  			],
  			'body-secondary': [
  				'Satoshi-Regular',
  				'sans-serif'
  			],
  			meta: [
  				'Satoshi-Italic',
  				'sans-serif'
  			],
  			highlight: [
  				'Satoshi-Bold',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			header: [
  				'1.75rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '0.02em'
  				}
  			],
  			'header-large': [
  				'2rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '0.02em'
  				}
  			],
  			'header-small': [
  				'1.5rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '0.02em'
  				}
  			],
  			subheader: [
  				'1.125rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em'
  				}
  			],
  			'subheader-large': [
  				'1.25rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em'
  				}
  			],
  			'subheader-small': [
  				'1rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em'
  				}
  			],
  			'body-primary': [
  				'1rem',
  				{
  					lineHeight: '1.5',
  					letterSpacing: '-0.005em'
  				}
  			],
  			'body-primary-large': [
  				'1.125rem',
  				{
  					lineHeight: '1.5',
  					letterSpacing: '-0.005em'
  				}
  			],
  			'body-medium': [
  				'1rem',
  				{
  					lineHeight: '1.5',
  					letterSpacing: '-0.005em'
  				}
  			],
  			'body-medium-small': [
  				'0.875rem',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.005em'
  				}
  			],
  			'body-secondary': [
  				'0.875rem',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.005em'
  				}
  			],
  			'body-secondary-small': [
  				'0.75rem',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.005em'
  				}
  			],
  			meta: [
  				'0.75rem',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.005em'
  				}
  			],
  			'meta-medium': [
  				'0.875rem',
  				{
  					lineHeight: '1.4',
  					letterSpacing: '-0.005em'
  				}
  			],
  			highlight: [
  				'1.125rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em'
  				}
  			],
  			'highlight-large': [
  				'1.25rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em'
  				}
  			],
  			'highlight-small': [
  				'0.9375rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em'
  				}
  			]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}



