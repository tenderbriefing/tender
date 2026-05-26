import { 
  BriefcaseIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

const Stats = () => {
  const stats = [
    {
      icon: BriefcaseIcon,
      value: '500+',
      label: 'Tenders Listed',
      description: 'Active tender opportunities across various sectors'
    },
    {
      icon: UserGroupIcon,
      value: '1,200+',
      label: 'Verified Connectors',
      description: 'Reliable individuals ready to attend briefings'
    },
    {
      icon: CurrencyDollarIcon,
      value: '$50K+',
      label: 'Earned by Connectors',
      description: 'Total income generated for youth employment'
    },
    {
      icon: CheckCircleIcon,
      value: '98%',
      label: 'Success Rate',
      description: 'Successful briefing attendance and documentation'
    }
  ]

  const gradientColors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-brand-700 to-brand-900',
    'from-yellow-500 to-orange-500'
  ]

  return (
    <section className="py-24 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
            Real Impact
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
              Making a Real
            </span>
            <br />
            <span className="bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Impact
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            TenderConnect is transforming how businesses access tender opportunities 
            while creating meaningful employment for young people across South Africa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="group text-center">
              <div className="relative mb-6">
                <div className={`bg-gradient-to-br ${gradientColors[index]} rounded-3xl p-6 shadow-2xl mx-auto w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-all duration-500`}>
                  <stat.icon className="h-10 w-10 text-white" />
                </div>
                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors[index]} rounded-3xl opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500`}></div>
              </div>
              <div className="text-5xl font-bold mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                {stat.value}
              </div>
              <div className="text-xl font-bold mb-3 text-white group-hover:text-purple-300 transition-colors duration-300">
                {stat.label}
              </div>
              <div className="text-gray-300 text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Enhanced Impact Statement */}
        <div className="text-center">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 max-w-6xl mx-auto border border-white/20 shadow-2xl">
            <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              Creating Win-Win Solutions
            </h3>
            <p className="text-lg text-gray-300 mb-8 leading-relaxed">
              TenderConnect bridges the gap between entrepreneurs who need briefing attendance 
              and unemployed youth seeking meaningful work opportunities. Our platform creates 
              value for both parties while contributing to economic growth and youth empowerment.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="group p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                <h4 className="font-bold mb-4 text-lg text-white group-hover:text-purple-300 transition-colors duration-300">For Entrepreneurs:</h4>
                <ul className="text-gray-300 space-y-2 group-hover:text-gray-200 transition-colors duration-300">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                    Access to more tender opportunities
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    Reduced travel costs and time
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Professional briefing documentation
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                    Competitive advantage in bidding
                  </li>
                </ul>
              </div>
              <div className="group p-6 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                <h4 className="font-bold mb-4 text-lg text-white group-hover:text-blue-300 transition-colors duration-300">For Youth:</h4>
                <ul className="text-gray-300 space-y-2 group-hover:text-gray-200 transition-colors duration-300">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
                    Flexible income opportunities
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                    Professional skill development
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    Networking and experience building
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                    Pathway to future employment
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Stats
