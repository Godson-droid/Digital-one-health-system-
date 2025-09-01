import React, { useState, useEffect } from 'react';

const LandingPage = ({ onLogin, onRegister, systemStatus }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    
    // Auto-rotate features
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 6);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: "🔐",
      title: "Blockchain Security",
      description: "Native proof-of-work blockchain with SHA-256 cryptographic integrity"
    },
    {
      icon: "🏥",
      title: "Multi-Domain Health",
      description: "Human, animal, and environmental health data management"
    },
    {
      icon: "🔒",
      title: "AES-256 Encryption",
      description: "Military-grade encryption for all sensitive health records"
    },
    {
      icon: "📱",
      title: "Multi-Factor Auth",
      description: "TOTP-based MFA with backup codes for enhanced security"
    },
    {
      icon: "🌍",
      title: "Global Access",
      description: "Secure access across all 36 states and FCT with role-based permissions"
    },
    {
      icon: "⚡",
      title: "Real-Time Integrity",
      description: "Instant blockchain verification and immutable audit trails"
    }
  ];

  const stats = [
    { value: "256-bit", label: "AES Encryption" },
    { value: "SHA-256", label: "Blockchain Hash" },
    { value: "30-sec", label: "TOTP Window" },
    { value: "99.9%", label: "Uptime SLA" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Digital One Health</h1>
                <p className="text-xs text-gray-600 -mt-1">Blockchain-Secured Health Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={onLogin}
                className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={onRegister}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full border border-blue-200">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                <span className="text-sm font-medium">🔐 Blockchain-Secured Health Platform</span>
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Securing Nigeria's{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                    OneHealth
                  </span>
                  <br />
                  Data Infrastructure
                </h1>
                
                <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
                  Nigeria's premier blockchain-secured health platform using AES encryption to protect human, animal, and environmental health records across all 36 states and FCT with mandatory multi-factor authentication.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={onRegister}
                  className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                >
                  <span>Start Secure Access</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                
                <button className="bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-200">
                  Learn More
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stat.value}</div>
                    <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Image */}
            <div className={`relative transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="relative bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=800"
                  alt="Healthcare professional with digital health icons"
                  className="w-full h-96 object-cover opacity-80"
                />
                
                {/* Floating Icons */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-80 h-80">
                    {features.map((feature, index) => (
                      <div
                        key={index}
                        className={`absolute w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${
                          activeFeature === index ? 'scale-110 bg-white/30 shadow-xl' : 'scale-100'
                        }`}
                        style={{
                          top: `${50 + 35 * Math.sin((index * Math.PI * 2) / 6)}%`,
                          left: `${50 + 35 * Math.cos((index * Math.PI * 2) / 6)}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {feature.icon}
                      </div>
                    ))}
                    
                    {/* Center Icon */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white/30 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              One Health, One Platform
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive health data management across all interconnected domains
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group p-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 ${
                  activeFeature === index ? 'ring-2 ring-blue-500 shadow-xl' : ''
                }`}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold leading-tight">
                  Enterprise-Grade Security
                  <br />
                  <span className="text-blue-300">Built for Healthcare</span>
                </h2>
                <p className="text-xl text-blue-100 leading-relaxed">
                  Our platform implements multiple layers of cryptographic security to ensure your health data remains protected and tamper-proof.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { icon: "🔐", title: "AES-256 Encryption", desc: "Military-grade data protection" },
                  { icon: "⛓️", title: "Blockchain Integrity", desc: "Immutable record verification" },
                  { icon: "🔑", title: "Multi-Factor Authentication", desc: "TOTP-based additional security" },
                  { icon: "🛡️", title: "Role-Based Access", desc: "Granular permission controls" }
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                    <div className="text-2xl">{item.icon}</div>
                    <div>
                      <h4 className="font-semibold text-white">{item.title}</h4>
                      <p className="text-blue-200 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
                <h3 className="text-2xl font-bold text-white mb-6 text-center">Security Architecture</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                    <span className="text-white font-medium">Authentication Layer</span>
                    <span className="text-green-300">✓ JWT + MFA</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                    <span className="text-white font-medium">Data Layer</span>
                    <span className="text-green-300">✓ AES-256</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                    <span className="text-white font-medium">Integrity Layer</span>
                    <span className="text-green-300">✓ Blockchain</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                    <span className="text-white font-medium">Access Layer</span>
                    <span className="text-green-300">✓ RBAC</span>
                  </div>
                </div>

                {systemStatus && (
                  <div className="mt-6 p-4 bg-green-500/20 rounded-xl border border-green-400/30">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-green-300 font-medium">System Status: {systemStatus.status}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <h2 className="text-4xl font-bold text-gray-900">
              Ready to Secure Your Health Data?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join Nigeria's most secure health data platform. Start protecting your health records with blockchain technology today.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={onRegister}
                className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-10 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
              >
                <span>Create Secure Account</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              
              <button
                onClick={onLogin}
                className="bg-gray-100 text-gray-700 px-10 py-4 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Sign In to Dashboard
              </button>
            </div>

            <div className="pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                🔒 Your data is protected by enterprise-grade security • 🌍 Available across Nigeria • ⚡ Real-time blockchain verification
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="font-bold">Digital One Health</span>
              </div>
              <p className="text-gray-400 text-sm">
                Securing Nigeria's health data infrastructure with blockchain technology and enterprise-grade encryption.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Human Health Records</li>
                <li>Animal Health Data</li>
                <li>Environmental Monitoring</li>
                <li>Research Analytics</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Security</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>AES-256 Encryption</li>
                <li>Blockchain Integrity</li>
                <li>Multi-Factor Auth</li>
                <li>Role-Based Access</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Security Guide</li>
                <li>Contact Support</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2025 Digital One Health System. All rights reserved. • Built with enterprise security standards.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;