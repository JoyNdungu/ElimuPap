import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';

export default function UnitsPage() {
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.get('/units', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnits(res.data);
    } catch (err) {
      setError('Failed to fetch units.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!unitCode || !unitName) return;

    setIsSubmitting(true);
    setError('');
    
    try {
      const token = localStorage.getItem('elimupap_token');
      const res = await api.post('/units/', {
        unit_code: unitCode,
        unit_name: unitName,
        topics: []   // topics come from uploaded notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setUnits([...units, res.data]);
      setUnitCode('');
      setUnitName('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to add unit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (unitId) => {
    try {
      const token = localStorage.getItem('elimupap_token');
      await api.delete(`/units/${unitId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnits(units.filter(u => u.id !== unitId));
    } catch (err) {
      setError('Failed to delete unit.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh font-sans" style={{ backgroundColor: '#17171F' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto pb-28 lg:pb-10 relative min-w-0">
        <main className="max-w-[1000px] mx-auto px-4 sm:px-10 py-6 sm:py-10">
          
          <header className="mb-8 sm:mb-10 animate-fade-in">
            <h1 className="font-display text-2xl sm:text-[2.5rem] text-white leading-tight mb-2 sm:mb-3 tracking-tight">
              My Semester Units
            </h1>
            <p className="text-[14px] leading-relaxed" style={{ color: '#9ca3af' }}>
              Register your units and topics for this semester to organise your uploaded notes effectively.
            </p>
          </header>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Form Section */}
            <div className="lg:w-1/3 animate-slide-up">
              <div className="rounded-2xl p-6" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                <h2 className="text-lg font-medium text-white mb-6">Add New Unit</h2>
                
                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <form onSubmit={handleAddUnit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>Unit Code</label>
                    <input type="text" required placeholder="e.g. ECON 101" value={unitCode} onChange={e => setUnitCode(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                      style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.1em] mb-2" style={{ color: '#9898c0' }}>Unit Name</label>
                    <input type="text" required placeholder="e.g. Macroeconomics" value={unitName} onChange={e => setUnitName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#5B57FF]"
                      style={{ backgroundColor: '#11111a', border: '1px solid #2d2d4a' }} />
                  </div>
                  <p className="text-[11px]" style={{ color: '#6b7280' }}>
                    Topics are added automatically when you upload notes to this unit.
                  </p>
                  
                  <button type="submit" disabled={isSubmitting} className="w-full py-2.5 mt-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ backgroundColor: '#5B57FF', color: '#fff' }}>
                    {isSubmitting ? 'Adding...' : 'Register Unit'}
                  </button>
                </form>
              </div>
            </div>

            {/* List Section */}
            <div className="lg:w-2/3 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                  <p className="text-gray-400">Loading units...</p>
                ) : units.length === 0 ? (
                  <div className="col-span-full p-8 text-center rounded-2xl" style={{ backgroundColor: '#1F1F2A', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <p className="text-gray-400 text-sm">You haven't registered any units yet. Add your first unit to get started.</p>
                  </div>
                ) : (
                  units.map(unit => (
                    <div key={unit.id} className="rounded-2xl p-5 relative" style={{ backgroundColor: '#1F1F2A', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <button onClick={() => handleDelete(unit.id)} className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(91,87,255,0.1)' }}>
                        <svg className="w-5 h-5 text-[#7571ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                      <h3 className="text-white font-medium text-lg pr-8">{unit.unit_name}</h3>
                      <p className="text-xs font-mono font-bold mt-1 px-2 py-0.5 rounded self-start inline-block" style={{ backgroundColor: '#11111a', color: '#9ca3af' }}>{unit.unit_code}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
