'use client'

import { useState, useEffect } from 'react'
import { InputTextarea } from 'primereact/inputtextarea'
import { Button } from 'primereact/button'
import { Toast } from 'primereact/toast'
import { useRef } from 'react'

interface UserProfile {
  about_me?: string
  llm_personalization?: string
}

interface ProfileSettingsProps {
  userId: string
}

export function ProfileSettings({ userId }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<UserProfile>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useRef<Toast>(null)

  useEffect(() => {
    loadProfile()
  }, [userId])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data || {})
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      })

      if (response.ok) {
        toast.current?.show({
          severity: 'success',
          summary: 'Success',
          detail: 'Profile updated successfully',
        })
      } else {
        throw new Error('Failed to save profile')
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save profile',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="border rounded-lg p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toast ref={toast} />
      <div className="space-y-6">
        {/* About Me Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">About Me</h3>
          <p className="text-sm text-gray-600 mb-4">
            Tell us about yourself, your background, current role, and goals. This information helps personalize your experience and improves the quality of AI-generated insights and reviews.
          </p>
          <InputTextarea
            value={profile.about_me || ''}
            onChange={(e) => setProfile(prev => ({ ...prev, about_me: e.target.value }))}
            placeholder="Share your background, current role, interests, and what you're working towards..."
            rows={6}
            className="w-full"
            autoResize
          />
        </div>

        {/* LLM Personalization Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">LLM Personalization</h3>
          <p className="text-sm text-gray-600 mb-4">
            Provide specific instructions for how AI should interact with you. This might include your preferred communication style, areas of focus, or specific context you want included in AI responses.
          </p>
          <InputTextarea
            value={profile.llm_personalization || ''}
            onChange={(e) => setProfile(prev => ({ ...prev, llm_personalization: e.target.value }))}
            placeholder="Example: Use a direct, action-oriented tone. Focus on practical next steps. I'm a software engineer working on personal productivity tools..."
            rows={4}
            className="w-full"
            autoResize
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            label="Save Profile"
            icon="pi pi-save"
            onClick={saveProfile}
            loading={saving}
            className="px-6 py-2"
          />
        </div>
      </div>
    </>
  )
}