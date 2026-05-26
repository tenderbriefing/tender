import { 
  DocumentTextIcon, 
  UserGroupIcon, 
  CreditCardIcon,
  MicrophoneIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  DevicePhoneMobileIcon,
  QuestionMarkCircleIcon,
  HeartIcon
} from '@heroicons/react/24/outline'

const Features = () => {
  const features = [
    {
      icon: DocumentTextIcon,
      title: 'Tender Listings & Updates',
      description: 'Regularly updated database of tenders ensuring entrepreneurs have access to the latest opportunities.'
    },
    {
      icon: UserGroupIcon,
      title: 'Connector Matching',
      description: 'Sophisticated algorithm matches entrepreneurs with suitable Connectors based on location, expertise, and availability.'
    },
    {
      icon: CreditCardIcon,
      title: 'Secure Payment Integration',
      description: 'Secure payment gateway allowing entrepreneurs to make hassle-free payments for briefing attendance services.'
    },
    {
      icon: MicrophoneIcon,
      title: 'Audio Recording & Notes',
      description: 'Connectors record audio and capture important information using provided templates, uploading comprehensive notes.'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Quality Control',
      description: 'Rigorous quality control mechanism reviews submitted materials for accuracy and adherence to platform standards.'
    },
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Secure Communication',
      description: 'Privacy-focused messaging system facilitating communication between entrepreneurs and Connectors within the platform.'
    },
    {
      icon: StarIcon,
      title: 'Rating & Feedback System',
      description: 'Both entrepreneurs and Connectors can rate and provide feedback, promoting accountability and continuous improvement.'
    },
    {
      icon: DevicePhoneMobileIcon,
      title: 'Mobile-Friendly Interface',
      description: 'Mobile-friendly design enabling seamless access and interaction using smartphones or tablets.'
    },
    {
      icon: QuestionMarkCircleIcon,
      title: 'Support & Assistance',
      description: 'Dedicated support system with help resources, FAQs, and prompt customer support for all users.'
    },
    {
      icon: HeartIcon,
      title: 'Youth Empowerment',
      description: 'Addresses youth unemployment by providing income-generating opportunities and valuable work experience.'
    }
  ]

  const gradientColors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-brand-700 to-brand-800',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500',
    'from-pink-500 to-rose-500',
    'from-teal-500 to-blue-500',
    'from-orange-500 to-red-500',
    'from-violet-500 to-purple-500',
    'from-accent-500 to-accent-600'
  ]

  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
            Platform Features
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            <span className="bg-gradient-to-r from-gray-900 via-purple-800 to-pink-800 bg-clip-text text-transparent">
              Comprehensive Features
            </span>
            <br />
            <span className="text-purple-600">for Success</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            TenderConnect provides all the tools and features needed to revolutionize 
            the tender briefing attendance process with cutting-edge technology and user-centric design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="group relative p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 hover:-translate-y-2"
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors[index % gradientColors.length]} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start mb-6">
                  <div className={`h-16 w-16 bg-gradient-to-br ${gradientColors[index % gradientColors.length]} rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors duration-300">
                      {feature.title}
                    </h3>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  {feature.description}
                </p>
                
                {/* Hover indicator */}
                <div className="mt-6 flex items-center text-purple-600 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  <span className="text-sm font-medium">Learn more</span>
                  <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-4 right-4 w-2 h-2 bg-purple-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute bottom-4 left-4 w-1 h-1 bg-pink-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </div>
          ))}
        </div>
        
        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-2xl shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105 transform">
            <span>Explore All Features</span>
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Features
