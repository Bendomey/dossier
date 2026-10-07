import { config as defaultConfig } from '@epic-web/config/eslint'

/** @type {import("eslint").Linter.Config[]} */
export default [
	...defaultConfig,
	{
		ignores: ['app/components/arc/**'],
	},
	{
		rules: {
			'import/consistent-type-specifier-style': 'off',
			'import/no-duplicates': 'off',
		},
	},
]
