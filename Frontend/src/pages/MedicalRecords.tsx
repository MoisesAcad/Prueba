import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import { FileText, ChevronRight, Search, Filter, Calendar, User, Shield } from 'lucide-react';

interface HistoriaClinica {
  id_historia: number;
  fecha_creacion: string;
  estado_historia_clinica?: {
    nombre_estado: string;
  };
  perfil_medico?: {
    id_perfil_medico: number;
  };
}

interface PersonaInfo {
  id_persona: number;
  prenombres: string;
  primer_apellido: string;
  segundo_apellido: string;
  dni_idcarnet: string;
}

interface PacienteInfo {
  id_paciente: number;
  id_persona: number;
  id_historia: number;
}

const MedicalRecords: React.FC = () => {
  const { user } = useUser();
  const [records, setRecords] = useState<HistoriaClinica[]>([]);
  const [personasInfo, setPersonasInfo] = useState<{ [key: number]: PersonaInfo }>({});
  const [pacientesInfo, setPacientesInfo] = useState<{ [key: number]: PacienteInfo }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMedicalRecords();
    }
  }, [user]);

  const fetchMedicalRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      let historias: HistoriaClinica[] = [];
      let pacientesData: PacienteInfo[] = [];
      let personasData: PersonaInfo[] = [];

      if (user?.currentRole === 'admin') {
        // Administradores ven todas las historias
        const { data: historiasData, error: historiasError } = await supabase
          .from('historia_clinica')
          .select(`
            id_historia,
            fecha_creacion,
            estado_historia_clinica:id_estado (
              nombre_estado
            ),
            perfil_medico:id_perfil_medico (
              id_perfil_medico
            )
          `)
          .order('fecha_creacion', { ascending: false });

        if (historiasError) throw historiasError;
        historias = historiasData || [];

        // Obtener todos los pacientes
        const { data: allPacientes, error: pacientesError } = await supabase
          .from('paciente')
          .select('id_paciente, id_persona, id_historia');

        if (pacientesError) throw pacientesError;
        pacientesData = allPacientes || [];

        // Obtener todas las personas
        const personaIds = pacientesData.map(p => p.id_persona);
        if (personaIds.length > 0) {
          const { data: allPersonas, error: personasError } = await supabase
            .from('persona')
            .select('id_persona, prenombres, primer_apellido, segundo_apellido, dni_idcarnet')
            .in('id_persona', personaIds);

          if (personasError) throw personasError;
          personasData = allPersonas || [];
        }

      } else if (user?.currentRole === 'medical') {
        // Personal médico ve historias de pacientes con los que ha tenido citas
        const { data: citasData, error: citasError } = await supabase
          .from('cita_medica')
          .select(`
            paciente:id_paciente (
              id_paciente,
              id_persona,
              id_historia,
              historia_clinica:id_historia (
                id_historia,
                fecha_creacion,
                estado_historia_clinica:id_estado (
                  nombre_estado
                ),
                perfil_medico:id_perfil_medico (
                  id_perfil_medico
                )
              )
            )
          `)
          .eq('personal_medico.persona.dni_idcarnet', user.dni);

        if (citasError) throw citasError;

        // Procesar datos de citas para extraer historias únicas
        const historiasMap = new Map();
        const pacientesMap = new Map();

        citasData?.forEach((cita: any) => {
          if (cita.paciente?.historia_clinica) {
            const historia = cita.paciente.historia_clinica;
            const paciente = cita.paciente;
            
            historiasMap.set(historia.id_historia, historia);
            pacientesMap.set(paciente.id_paciente, {
              id_paciente: paciente.id_paciente,
              id_persona: paciente.id_persona,
              id_historia: paciente.id_historia
            });
          }
        });

        historias = Array.from(historiasMap.values());
        pacientesData = Array.from(pacientesMap.values());

        // Obtener información de personas
        const personaIds = pacientesData.map(p => p.id_persona);
        if (personaIds.length > 0) {
          const { data: personasResult, error: personasError } = await supabase
            .from('persona')
            .select('id_persona, prenombres, primer_apellido, segundo_apellido, dni_idcarnet')
            .in('id_persona', personaIds);

          if (personasError) throw personasError;
          personasData = personasResult || [];
        }

      } else {
        // Pacientes ven su propia historia y las de personas asociadas
        const profileIds = user?.profiles?.map(p => parseInt(p.id)) || [];
        
        if (profileIds.length > 0) {
          // Obtener pacientes asociados a estos perfiles
          const { data: pacientesResult, error: pacientesError } = await supabase
            .from('paciente')
            .select(`
              id_paciente,
              id_persona,
              id_historia,
              historia_clinica:id_historia (
                id_historia,
                fecha_creacion,
                estado_historia_clinica:id_estado (
                  nombre_estado
                ),
                perfil_medico:id_perfil_medico (
                  id_perfil_medico
                )
              )
            `)
            .in('id_persona', profileIds);

          if (pacientesError) throw pacientesError;

          // Extraer historias y pacientes
          pacientesResult?.forEach((paciente: any) => {
            if (paciente.historia_clinica) {
              historias.push(paciente.historia_clinica);
              pacientesData.push({
                id_paciente: paciente.id_paciente,
                id_persona: paciente.id_persona,
                id_historia: paciente.id_historia
              });
            }
          });

          // Obtener información de personas
          const { data: personasResult, error: personasError } = await supabase
            .from('persona')
            .select('id_persona, prenombres, primer_apellido, segundo_apellido, dni_idcarnet')
            .in('id_persona', profileIds);

          if (personasError) throw personasError;
          personasData = personasResult || [];
        }
      }

      // Convertir arrays a objetos para fácil acceso
      const personasMap: { [key: number]: PersonaInfo } = {};
      personasData.forEach(persona => {
        personasMap[persona.id_persona] = persona;
      });

      const pacientesMap: { [key: number]: PacienteInfo } = {};
      pacientesData.forEach(paciente => {
        pacientesMap[paciente.id_historia] = paciente;
      });

      setRecords(historias);
      setPersonasInfo(personasMap);
      setPacientesInfo(pacientesMap);

    } catch (error) {
      console.error('Error fetching medical records:', error);
      setError('Error al cargar las historias clínicas');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    
    // Buscar por información del paciente
    const paciente = pacientesInfo[record.id_historia];
    if (paciente) {
      const persona = personasInfo[paciente.id_persona];
      if (persona) {
        const nombreCompleto = `${persona.prenombres} ${persona.primer_apellido} ${persona.segundo_apellido}`.toLowerCase();
        const dni = persona.dni_idcarnet.toLowerCase();
        const search = searchTerm.toLowerCase();
        
        return nombreCompleto.includes(search) || dni.includes(search);
      }
    }
    
    return false;
  });

  if (!user) return null;

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historias clínicas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-12">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Shield className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Historias Clínicas</h1>
        
        {user.currentRole === 'admin' && (
          <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
            <Shield className="h-4 w-4 inline mr-1" />
            Vista de Administrador
          </div>
        )}
      </div>

      {selectedRecord ? (
        <MedicalRecordDetail 
          recordId={selectedRecord} 
          onBack={() => setSelectedRecord(null)}
          userRole={user.currentRole}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-64"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{filteredRecords.length} historia(s) encontrada(s)</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => {
                  // Encontrar la persona asociada a esta historia específica
                  const paciente = pacientesInfo[record.id_historia];
                  const persona = paciente ? personasInfo[paciente.id_persona] : null;
                  const nombreCompleto = persona ?
                    `${persona.prenombres} ${persona.primer_apellido} ${persona.segundo_apellido}` :
                    'Paciente';

                  return (
                    <div
                      key={record.id_historia}
                      className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedRecord?.(record.id_historia.toString())}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-blue-600 mr-2" />
                            <h3 className="font-medium text-gray-800">{nombreCompleto}</h3>
                          </div>
                          {persona && (
                            <p className="text-sm text-gray-500 mt-1">
                              DNI: {persona.dni_idcarnet}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">
                            Creada: {new Date(record.fecha_creacion).toLocaleDateString('es-ES')}
                          </p>
                          <p className="text-sm text-gray-500">
                            Estado: {record.estado_historia_clinica?.nombre_estado || 'Activa'}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  <p>No se encontraron historias clínicas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente para mostrar el detalle de una historia clínica
interface MedicalRecordDetailProps {
  recordId: string;
  onBack: () => void;
  userRole: string;
}

const MedicalRecordDetail: React.FC<MedicalRecordDetailProps> = ({ recordId, onBack, userRole }) => {
  const [recordDetail, setRecordDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecordDetail();
  }, [recordId]);

  const fetchRecordDetail = async () => {
    try {
      setLoading(true);
      
      // Aquí implementarías la lógica para obtener el detalle completo
      // de la historia clínica, incluyendo servicios médicos, diagnósticos, etc.
      
      const { data, error } = await supabase
        .from('historia_clinica')
        .select(`
          *,
          estado_historia_clinica:id_estado (
            nombre_estado,
            descripcion
          ),
          perfil_medico:id_perfil_medico (
            *
          )
        `)
        .eq('id_historia', recordId)
        .single();

      if (error) throw error;
      setRecordDetail(data);
    } catch (error) {
      console.error('Error fetching record detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <button 
          onClick={onBack}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <span className="mr-1">←</span> Volver a la lista
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Historia Clínica</h2>
            <p className="text-gray-600">ID: {recordId}</p>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            {recordDetail?.estado_historia_clinica?.nombre_estado || 'Activa'}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Información General</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Fecha de Creación:</span>
                <p className="font-medium">
                  {recordDetail?.fecha_creacion ? 
                    new Date(recordDetail.fecha_creacion).toLocaleDateString('es-ES') : 
                    'No disponible'
                  }
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Estado:</span>
                <p className="font-medium">{recordDetail?.estado_historia_clinica?.nombre_estado || 'Activa'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Perfil Médico</h3>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Grupo Sanguíneo:</span>
                <p className="font-medium">{recordDetail?.perfil_medico?.grupo_sanguineo || 'No especificado'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Ambiente de Residencia:</span>
                <p className="font-medium">{recordDetail?.perfil_medico?.ambiente_residencia || 'No especificado'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Aquí puedes agregar más secciones como servicios médicos, diagnósticos, etc. */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Servicios Médicos Recientes</h3>
          <div className="bg-gray-50 rounded-md p-4">
            <p className="text-gray-600 text-center">
              Los servicios médicos se mostrarán aquí una vez implementada la funcionalidad completa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalRecords;