// Shared types for Configuration Schema Step components

export type ArgCategory = 'template' | 'team' | 'user'
export type EnvCategory = 'team' | 'user'
export type HeaderCategory = 'team' | 'user'
export type ItemType = 'arg' | 'env' | 'header'

export interface ConfigItem {
  id: string
  type: ItemType
  category: ArgCategory | EnvCategory | HeaderCategory
  name: string
  value?: string // For template args
  description: string
  dataType: string // 'string' | 'number' | 'boolean' | 'secret'
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean // For env vars and headers
}

export interface ConfigurationSchema {
  template_args?: TemplateArg[]
  template_env?: TemplateEnvVar[]
  template_headers?: TemplateHeaderVar[]
  team_args_schema?: TeamArgsSchema[]
  team_env_schema?: TeamEnvSchema[]
  team_headers_schema?: TeamHeadersSchema[]
  user_args_schema?: UserArgsSchema[]
  user_env_schema?: UserEnvSchema[]
  user_headers_schema?: UserHeadersSchema[]
}

export interface TemplateArg {
  value: string
  locked: boolean
  description?: string
}

export interface TemplateEnvVar {
  name: string
  value: string
  locked: boolean
  description?: string
}

export interface TemplateHeaderVar {
  name: string
  value: string
  locked: boolean
  description?: string
}

export interface TeamArgsSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
}

export interface TeamEnvSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean
}

export interface TeamHeadersSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
  default_team_locked?: boolean
  visible_to_users?: boolean
}

export interface UserArgsSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
}

export interface UserEnvSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
}

export interface UserHeadersSchema {
  name: string
  type: string
  description?: string
  required: boolean
  locked: boolean
}
