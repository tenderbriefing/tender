'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SmeCategoryCommoditySelector from '@/components/sme/SmeCategoryCommoditySelector'
import { toast } from 'react-hot-toast'
import { 
  UserIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  MapPinIcon,
  StarIcon,
  BriefcaseIcon,
  CalendarIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

const ProfilePage = () => {
  const { user, userProfile, loading } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    companyName: '',
    phoneNumber: '',
    location: '',
    skills: [] as string[],
    categories: [] as string[],
    commodities: [] as string[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        email: user?.email || '',
        companyName: userProfile.companyName || '',
        phoneNumber: userProfile.phoneNumber || '',
        location: userProfile.location || '',
        skills: userProfile.skills || [],
        categories: userProfile.categories || [],
        commodities: userProfile.commodities || [],
      })
    }
  }, [userProfile, user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSkillsChange = (skills: string[]) => {
    setFormData(prev => ({ ...prev, skills }))
  }

  const handleCategoriesChange = (categories: string[]) => {
    setFormData(prev => ({ ...prev, categories }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required'
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required'
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required'
    }

    if (userProfile?.userType === 'sme' && !formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required'
    }

    if (userProfile?.userType === 'sme' && formData.categories.length === 0) {
      newErrors.categories = 'Please select at least one category'
    }

    if (userProfile?.userType === 'youth-agent' && formData.skills.length === 0) {
      newErrors.skills = 'Please add at least one skill'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      // TODO: Implement profile update API call
      console.log('Updating profile:', formData)
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      toast.success('Profile updated successfully!')
      setIsEditing(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (userProfile) {
      setFormData({
        displayName: userProfile.displayName || '',
        email: user?.email || '',
        companyName: userProfile.companyName || '',
        phoneNumber: userProfile.phoneNumber || '',
        location: userProfile.location || '',
        skills: userProfile.skills || [],
        categories: userProfile.categories || [],
        commodities: userProfile.commodities || [],
      })
    }
    setErrors({})
    setIsEditing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
            <p className="text-gray-600">Please sign in to view your profile.</p>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              <p className="text-gray-600 mt-2">
                Manage your account information and preferences
              </p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary flex items-center gap-2"
              >
                <PencilIcon className="h-4 w-4" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Overview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <div className="mx-auto h-24 w-24 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                  <UserIcon className="h-12 w-12 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {userProfile.displayName}
                </h2>
                <p className="text-gray-600 capitalize">
                  {userProfile.userType}
                </p>
                {userProfile.rating && (
                  <div className="flex items-center justify-center mt-2">
                    <StarIcon className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="ml-1 text-sm text-gray-600">
                      {userProfile.rating.toFixed(1)} ({userProfile.totalJobs || 0} jobs)
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mt-6 space-y-4">
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="h-4 w-4 mr-3" />
                  <span>
                    Joined {new Date(userProfile.createdAt).toLocaleDateString('en-ZA')}
                  </span>
                </div>
                {userProfile.userType === 'sme' && (
                  <div className="flex items-center text-sm text-gray-600">
                    <BriefcaseIcon className="h-4 w-4 mr-3" />
                    <span>{userProfile.totalJobs || 0} bookings made</span>
                  </div>
                )}
                {userProfile.userType === 'youth-agent' && (
                  <div className="flex items-center text-sm text-gray-600">
                    <BriefcaseIcon className="h-4 w-4 mr-3" />
                    <span>{userProfile.totalJobs || 0} jobs completed</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">
                  Profile Information
                </h3>

                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Display Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="displayName"
                          value={formData.displayName}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                            errors.displayName ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter your display name"
                        />
                      ) : (
                        <p className="text-gray-900">{userProfile.displayName}</p>
                      )}
                      {errors.displayName && (
                        <p className="text-red-500 text-sm mt-1">{errors.displayName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <p className="text-gray-900">{user?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                  </div>

                  {/* Company Information (Entrepreneurs) */}
                  {userProfile.userType === 'sme' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company Name
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="companyName"
                          value={formData.companyName}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                            errors.companyName ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter your company name"
                        />
                      ) : (
                        <p className="text-gray-900">{userProfile.companyName || 'Not provided'}</p>
                      )}
                      {errors.companyName && (
                        <p className="text-red-500 text-sm mt-1">{errors.companyName}</p>
                      )}
                    </div>
                  )}

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                            errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter your phone number"
                        />
                      ) : (
                        <p className="text-gray-900">{userProfile.phoneNumber || 'Not provided'}</p>
                      )}
                      {errors.phoneNumber && (
                        <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                            errors.location ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="Enter your location"
                        />
                      ) : (
                        <p className="text-gray-900">{userProfile.location || 'Not provided'}</p>
                      )}
                      {errors.location && (
                        <p className="text-red-500 text-sm mt-1">{errors.location}</p>
                      )}
                    </div>
                  </div>

                  {/* Skills (Connectors) */}
                  {userProfile.userType === 'youth-agent' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Skills
                      </label>
                      {isEditing ? (
                        <div>
                          <input
                            type="text"
                            placeholder="Add a skill and press Enter"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const input = e.target as HTMLInputElement
                                const skill = input.value.trim()
                                if (skill && !formData.skills.includes(skill)) {
                                  handleSkillsChange([...formData.skills, skill])
                                  input.value = ''
                                }
                              }
                            }}
                          />
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.skills.map((skill, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                              >
                                {skill}
                                <button
                                  onClick={() => handleSkillsChange(formData.skills.filter((_, i) => i !== index))}
                                  className="text-primary-600 hover:text-primary-800"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {userProfile.skills?.map((skill, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                            >
                              {skill}
                            </span>
                          )) || <p className="text-gray-500">No skills added</p>}
                        </div>
                      )}
                      {errors.skills && (
                        <p className="text-red-500 text-sm mt-1">{errors.skills}</p>
                      )}
                    </div>
                  )}

                  {/* Categories (Entrepreneurs) */}
                  {userProfile.userType === 'sme' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Categories
                      </label>
                      {isEditing ? (
                        <SmeCategoryCommoditySelector
                          value={{
                            categories: formData.categories,
                            commodities: formData.commodities,
                          }}
                          onChange={({ categories, commodities }) =>
                            setFormData((prev) => ({ ...prev, categories, commodities }))
                          }
                          showFreeModelBanner={false}
                        />
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {userProfile.categories?.map((category, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                              >
                                {category}
                              </span>
                            )) || <p className="text-gray-500">No categories selected</p>}
                          </div>
                          {userProfile.commodities && userProfile.commodities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {userProfile.commodities.map((item, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {errors.categories && (
                        <p className="text-red-500 text-sm mt-1">{errors.categories}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {isEditing && (
                  <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  )
}

export default ProfilePage
