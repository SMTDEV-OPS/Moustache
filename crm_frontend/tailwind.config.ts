import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				/* CRM design tokens */
				bg: 'var(--bg)',
				surface: 'var(--surface)',
				primary: 'var(--primary)',
				'primary-light': 'var(--primary-light)',
				secondary: 'var(--secondary)',
				accent: 'var(--accent)',
				text: 'var(--text)',
				'text-muted': 'var(--text-muted)',
				'text-faint': 'var(--text-faint)',
				border: 'var(--border)',
				'border-light': 'var(--border-light)',
				hover: 'var(--hover)',
				'hot-bg': 'var(--hot-bg)',
				'hot-text': 'var(--hot-text)',
				'warm-bg': 'var(--warm-bg)',
				'warm-text': 'var(--warm-text)',
				'cold-bg': 'var(--cold-bg)',
				'cold-text': 'var(--cold-text)',
				'src-ivr-bg': 'var(--src-ivr-bg)',
				'src-ivr-text': 'var(--src-ivr-text)',
				'src-wa-bg': 'var(--src-wa-bg)',
				'src-wa-text': 'var(--src-wa-text)',
				'src-web-bg': 'var(--src-web-bg)',
				'src-web-text': 'var(--src-web-text)',
				'src-call-bg': 'var(--src-call-bg)',
				'src-call-text': 'var(--src-call-text)',
				'src-email-bg': 'var(--src-email-bg)',
				'src-email-text': 'var(--src-email-text)',
				/* Backward compat for existing shadcn components */
				background: 'var(--bg)',
				foreground: 'var(--text)',
				input: 'var(--border)',
				ring: 'var(--primary)',
				primary: { DEFAULT: 'var(--primary)', foreground: 'white' },
				destructive: { DEFAULT: '#ef4444', foreground: 'white' },
				accent: { DEFAULT: 'var(--hover)', foreground: 'var(--text)' },
				muted: { DEFAULT: 'var(--border-light)', foreground: 'var(--text-muted)' },
				card: { DEFAULT: 'var(--surface)', foreground: 'var(--text)' },
				popover: { DEFAULT: 'var(--surface)', foreground: 'var(--text)' },
				secondary: { DEFAULT: 'var(--border-light)', foreground: 'var(--text)' },
			},
			fontFamily: {
				sans: ['var(--font)'],
			},
			borderRadius: {
				sm: 'var(--radius-sm)',
				DEFAULT: 'var(--radius)',
				md: 'var(--radius-md)',
			},
			boxShadow: {
				DEFAULT: 'var(--shadow)',
			},
			spacing: {
				'1': 'var(--sp-1)',
				'2': 'var(--sp-2)',
				'3': 'var(--sp-3)',
				'4': 'var(--sp-4)',
				'5': 'var(--sp-5)',
				'6': 'var(--sp-6)',
				'8': 'var(--sp-8)',
				'10': 'var(--sp-10)',
			},
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
