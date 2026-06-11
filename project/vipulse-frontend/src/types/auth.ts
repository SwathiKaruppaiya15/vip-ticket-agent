export type UserRole = 'admin' | 'manager' | 'support_agent' | 'viewer'

export interface User {
  user_id:                 string
  username:                string
  email:                   string
  role:                    UserRole
  is_active:               boolean
  must_change_credentials: boolean
  is_first_login:          boolean
}

export interface Tokens {
  access_token:            string
  refresh_token:           string
  token_type:              string
  expires_in:              number
  must_change_credentials: boolean
}

export interface LoginRequest {
  email:    string
  password: string
}

export interface RegisterRequest {
  username: string
  email:    string
  password: string
  role:     UserRole
}

export interface ChangeCredentialsRequest {
  new_email:        string
  current_password: string
  new_password:     string
  confirm_password: string
}

export interface AuthResponse {
  user:   User
  tokens: Tokens
}
