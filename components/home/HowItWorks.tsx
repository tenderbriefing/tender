import { 
  MagnifyingGlassIcon, 
  UserPlusIcon, 
  CreditCardIcon,
  DocumentCheckIcon,
  StarIcon
} from '@heroicons/react/24/outline'

const HowItWorks = () => {
  const steps = [
    {
      icon: MagnifyingGlassIcon,
      title: 'Browse Tenders',
      description: 'SMEs browse through our updated database of available tender briefings.',
      step: '1'
    },
            {
              icon: UserPlusIcon,
              title: 'Request Youth Agent',
              description: 'Select a tender and request a Youth Agent to attend the briefing for you.',
              step: '2'
            },
    {
      icon: CreditCardIcon,
      title: 'Secure Payment',
      description: 'Make secure payment through our integrated payment gateway for the service.',
      step: '3'
    },
            {
              icon: DocumentCheckIcon,
              title: 'Attend & Document',
              description: 'Youth Agent attends the briefing, records audio, takes notes, and provides proof.',
              step: '4'
            },
    {
      icon: StarIcon,
      title: 'Quality Review',
      description: 'Our quality control team reviews all submissions before delivering to you.',
      step: '5'
    }
  ]

  const gradientColors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-brand-700 to-accent-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500'
  ]

  return (
    <section className="py-24 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
            Simple Process
          </div>
                  <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                    <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                      How It
                    </span>
                    <br />
                    <span className="text-blue-600">Works</span>
                  </h2>
                  <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
                    A simple process that connects SMEs with Youth Agents 
                    to attend tender briefings. Just 5 easy steps.
                  </p>
        </div>

        <div className="relative">
          {/* Enhanced Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-purple-200 via-blue-200 to-pink-200 transform -translate-y-1/2 z-0 rounded-full"></div>
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 transform -translate-y-1/2 z-0 rounded-full opacity-30 animate-pulse"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
            {steps.map((step, index) => (
              <div key={index} className="text-center group">
                <div className="relative mb-6">
                  <div className={`bg-gradient-to-br ${gradientColors[index]} rounded-3xl p-6 shadow-2xl mx-auto w-24 h-24 flex items-center justify-center relative group-hover:scale-110 transition-all duration-500`}>
                    <step.icon className="h-12 w-12 text-white" />
                    <div className="absolute -top-3 -right-3 bg-white text-gray-900 rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold shadow-lg border-2 border-gray-200 group-hover:scale-125 transition-transform duration-300">
                      {step.step}
                    </div>
                  </div>
                  {/* Glow effect */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors[index]} rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}></div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-700 transition-colors duration-300">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Additional Info */}
        <div className="mt-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2">
              <div className="text-center">
                <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-purple-700 transition-colors duration-300">For SMEs</h4>
                        <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                          Never miss tender opportunities due to time or location. 
                          Get briefing information without leaving your office.
                        </p>
              </div>
            </div>
            
            <div className="group p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2">
              <div className="text-center">
                <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                        <h4 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-blue-700 transition-colors duration-300">For Youth Agents</h4>
                        <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                          Earn money while gaining work experience. Build your network 
                          and develop skills in business documentation and communication.
                        </p>
              </div>
            </div>
            
            <div className="group p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2">
              <div className="text-center">
                <div className="h-16 w-16 bg-gradient-to-br from-brand-700 to-brand-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-green-700 transition-colors duration-300">Quality Assurance</h4>
                <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  All submissions go through rigorous quality control to ensure accuracy, 
                  completeness, and adherence to professional standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
