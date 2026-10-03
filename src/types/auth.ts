export type Gender = 'female' | 'male' | 'prefer_not_to_say'

export type AuthUser = {
  id: number
  name: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  birthday: string | null
  gender: Gender | null
  avatar_url: string | null
  banner_url: string | null
  headline: string | null
  pronouns: string | null
  location: string | null
  bio: string | null
  website: string | null
  /** Shown on your profile to your society; separate from the email/mobile you sign in with. */
  contact_email: string | null
  contact_phone: string | null
  role: string
  status: string
  created_at: string | null
}

export type AuthResponse = {
  message: string
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: AuthUser
}

export type LoginPayload = {
  identifier: string
  password: string
}

export type RegisterPayload = {
  first_name: string
  last_name: string
  birthday: string
  gender: Gender
  contact: string
  password: string
}

export type ApiValidationErrors = Record<string, Array<string>>
