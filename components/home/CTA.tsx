'use client'

import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { 
  ArrowRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

const CTA = () => {
  const { user } = useAuth()

  const benefits = [
    'No more missed tender opportunities',
    'Professional briefing documentation',
    'Verified and reliable Connectors',
    'Secure payment processing',
    '24/7 customer support'
  ]

  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
            Get Started Today
          </div>
          
                  <h2 className="text-4xl md:text-5xl font-bold mb-6">
                    <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                      Ready to Get Started?
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                      Simple & Clear
                    </span>
                  </h2>
                  <p className="text-xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
                    Join SMEs and Youth Agents using our simple platform to connect 
                    and work together on tender briefings.
                  </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-5xl mx-auto">
            <div className="group p-8 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-500 hover:scale-105">
              <h3 className="text-2xl font-bold mb-6 text-white group-hover:text-purple-300 transition-colors duration-300">For SMEs</h3>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center group/item">
                    <div className="h-6 w-6 bg-gradient-to-br from-accent-500 to-accent-600 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                      <CheckCircleIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gray-300 group-hover/item:text-white transition-colors duration-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="group p-8 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-500 hover:scale-105">
              <h3 className="text-2xl font-bold mb-6 text-white group-hover:text-blue-300 transition-colors duration-300">For Youth Agents</h3>
              <ul className="space-y-4">
                <li className="flex items-center group/item">
                  <div className="h-6 w-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-300 group-hover/item:text-white transition-colors duration-300">Flexible work schedule</span>
                </li>
                <li className="flex items-center group/item">
                  <div className="h-6 w-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-300 group-hover/item:text-white transition-colors duration-300">Competitive compensation</span>
                </li>
                <li className="flex items-center group/item">
                  <div className="h-6 w-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-300 group-hover/item:text-white transition-colors duration-300">Professional development</span>
                </li>
                <li className="flex items-center group/item">
                  <div className="h-6 w-6 bg-gradient-to-br from-accent-500 to-accent-600 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-300 group-hover/item:text-white transition-colors duration-300">Networking opportunities</span>
                </li>
                <li className="flex items-center group/item">
                  <div className="h-6 w-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mr-4 group-hover/item:scale-110 transition-transform duration-300">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-gray-300 group-hover/item:text-white transition-colors duration-300">Verified and secure platform</span>
                </li>
              </ul>
            </div>
          </div>

          {user ? (
            <Link 
              href="/dashboard" 
              className="group inline-flex items-center px-12 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 hover:scale-105 transform text-lg"
            >
              <span>Go to Dashboard</span>
              <ArrowRightIcon className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
                      <Link 
                        href="/auth/signup?type=sme" 
                        className="group inline-flex items-center px-12 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 hover:scale-105 transform text-lg"
                      >
                        <span>I'm an SME</span>
                        <ArrowRightIcon className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform duration-300" />
                      </Link>
                      <Link 
                        href="/auth/signup?type=youth-agent" 
                        className="group inline-flex items-center px-12 py-5 bg-white/10 backdrop-blur-sm text-white font-bold rounded-2xl border-2 border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-xl hover:shadow-white/10 hover:scale-105 transform text-lg"
                      >
                        <span>I'm a Youth Agent</span>
                        <ArrowRightIcon className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform duration-300" />
                      </Link>
            </div>
          )}

          <p className="text-gray-400 mt-8 text-lg">
            Join our simple platform today - SMEs and Youth Agents working together
          </p>
        </div>
      </div>
    </section>
  )
}

export default CTA
