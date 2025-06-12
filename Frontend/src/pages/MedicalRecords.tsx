import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  FileText, 
  Calendar, 
  User, 
  Shield,
  AlertTriangle,
  ChevronRight,
  Clock,
  Stethoscope,
  Activity
} from 'lucide-react';

type HistoriaClinica = {
  id_historia: number;
  id_estado: number;
  id_perfil_medico: number;
  fecha_creacion: string;
  estado_historia_clinica: {
    nombre_estado: string;
    descripcion: string;
  };
  perfil_medico: {
    fecha_atencion: string;
    grupo_sanguineo: string;
    ambiente_residencia: string;
    orientacion_sexual: string;
    vida_sexual_activa: boolean;
  };
  paciente: {
    id_paciente: number;
    id_persona: number;
    tipo_seguro: string;
    situacion_juridica: string;
    esta_vivo: boolean;
    etapa_vida: string;
    persona: {
      id_persona: number;
      prenombres: string;
      primer_apellido: string;
      segundo_apellido: string;
      dni_idcarnet: string;
      sexo: string;
      fecha_nacimiento: string;
      direccion_legal: string;
      correo_electronico: string;
      numero_celular_personal: string;
      numero_celular_emergencia: string;
    };
  }[];
};

type PersonaInfo = {
  id_persona: number;
  prenombres: string;
  primer_apellido: string;
  segundo_apellido: string;
  dni_idcarnet: string;
  sexo: string;
  fecha_nacimiento: string;
  direccion_legal: string;
  correo_electronico: string;
  numero_celular_personal: string;
  numero_celular_emergencia: string;
};

const MedicalRecords: React.FC = () => {
  const { user } = useUser();
  const [historias, setHistorias] = useState<HistoriaClinica[]>([]);
  const [personasInfo, setPersonasInfo] = useState<{[key: number]: PersonaInfo}>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHistoria, setSelectedHistoria] = useState<HistoriaClinica | null>(null);

  useEffect(() => {
    if (user) {
      fetchHistoriasClinicas();
    }
  }, [user]);

  const fetchHistoriasClinicas = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('historia_clinica')
        .select(`
          id_historia,
          id_estado,
          id_perfil_medico,
          fecha_creacion,
          estado_historia_clinica:id_estado (
            nombre_estado,
            descripcion
          ),
          perfil_medico:id_perfil_medico (
            fecha_atencion,
            grupo_sanguineo,
            ambiente_residencia,
            orientacion_sexual,
            vida_sexual_activa
          ),
          paciente!inner (
            id_paciente,
            id_persona,
            tipo_seguro,
            situacion_juridica,
            esta_vivo,
            etapa_vida,
            persona:id_persona (
              id_persona,
              prenombres,
              primer_apellido,
              segundo_apellido,
              dni_idcarnet,
              sexo,
              fecha_nacimiento,
              direccion_legal,
              correo_electronico,
              numero_celular_personal,
              numero_celular_emergencia
            )
          )
        `);

      // Filtrar según el rol del usuario
      if (user.currentRole === 'patient') {
        // Para pacientes: mostrar su propia historia y las de personas relacionadas
        const profileIds = user.profiles.map(profile => parseInt(profile.id));
        query = query.in('paciente.id_persona', profileIds);
      } else if (user.currentRole === 'medical') {
        // Para médicos: mostrar historias de pacientes con los que han tenido citas
        const { data: citasData } = await supabase
          .from('cita_medica')
          .select('id_paciente')
          .eq('personal_medico.persona.id_persona', parseInt(user.currentProfileId));
        
        if (citasData && citasData.length > 0) {
          const pacienteIds = citasData.map(cita => cita.id_paciente);
          query = query.in('paciente.id_paciente', pacienteIds);
        } else {
          // Si no tiene citas, no mostrar nada
          setHistorias([]);
          setLoading(false);
          return;
        }
      }
      // Para administradores: mostrar todas las historias (sin filtro adicional)

      const { data, error } = await query.order('fecha_creacion', { ascending: false });

      if (error) throw error;

      setHistorias(data || []);

      // Crear un mapa de información de personas para búsqueda eficiente
      const personasMap: {[key: number]: PersonaInfo} = {};
      data?.forEach(historia => {
        historia.paciente.forEach(paciente => {
          if (paciente.persona) {
            personasMap[paciente.persona.id_persona] = paciente.persona;
          }
        });
      });
      setPersonasInfo(personasMap);

    } catch (error) {
      console.error('Error fetching historias clínicas:', error);
      setError('Error al cargar las historias clínicas');
    } finally {
      setLoading(false);
    }
  };

  const getPacienteInfo = (historia: HistoriaClinica) => {
    // Obtener el primer paciente asociado a esta historia clínica
    const paciente = historia.paciente[0];
    if (paciente && paciente.persona) {
      return paciente.persona;
    }
    return null;
  };

  const filteredHistorias = historias.filter(historia => {
    if (!searchTerm) return true;

    // Buscar en la información del paciente asociado a esta historia específica
    const pacienteInfo = getPacienteInfo(historia);
    if (pacienteInfo) {
      const nombreCompleto = `${pacienteInfo.prenombres} ${pacienteInfo.primer_apellido} ${pacienteInfo.segundo_apellido}`.toLowerCase();
      return nombreCompleto.includes(searchTerm.toLowerCase()) ||
             pacienteInfo.dni_idcarnet.includes(searchTerm);
    }

    return false;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'activa':
        return 'bg-green-100 text-green-800';
      case 'inactiva':
        return 'bg-red-100 text-red-800';
      case 'en revisión':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) return null;

  // Verificar permisos
  if (user.currentRole !== 'patient' && user.currentRole !== 'admin' && user.currentRole !== 'medical') {
    return (
      <div className="container mx-auto text-center py-12">
        <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Acceso Restringido</h2>
        <p className="text-gray-600">
          No tienes permisos para acceder a las historias clínicas.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Cargando historias clínicas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
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
        
        {user.currentRole === 'patient' && user.profiles.length > 1 && (
          <div className="text-sm text-gray-600">
            Mostrando historias de: {user.profiles.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {selectedHistoria ? (
        <HistoriaDetail 
          historia={selectedHistoria} 
          onBack={() => setSelectedHistoria(null)}
          userRole={user.currentRole}
        />
      ) : (
        <>
          {/* Barra de búsqueda */}
          <div className="mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Lista de historias */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {filteredHistorias.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paciente
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Documento
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha Creación
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Última Atención
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredHistorias.map((historia) => {
                      const pacienteInfo = getPacienteInfo(historia);
                      return (
                        <tr key={historia.id_historia} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <User className="h-5 w-5 text-gray-400 mr-3" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {pacienteInfo ? 
                                    `${pacienteInfo.prenombres} ${pacienteInfo.primer_apellido} ${pacienteInfo.segundo_apellido}` :
                                    'Información no disponible'
                                  }
                                </div>
                                <div className="text-sm text-gray-500">
                                  {pacienteInfo?.correo_electronico || 'Sin email'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {pacienteInfo?.dni_idcarnet || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {formatDate(historia.fecha_creacion)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              getStatusColor(historia.estado_historia_clinica?.nombre_estado)
                            }`}>
                              {historia.estado_historia_clinica?.nombre_estado || 'Sin estado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {historia.perfil_medico?.fecha_atencion ? 
                                formatDate(historia.perfil_medico.fecha_atencion) : 
                                'Sin atención registrada'
                              }
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => setSelectedHistoria(historia)}
                              className="text-blue-600 hover:text-blue-800 flex items-center"
                            >
                              Ver detalles
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'No se encontraron historias' : 'No hay historias clínicas'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm 
                    ? 'Intenta con otros términos de búsqueda'
                    : user.currentRole === 'patient' 
                      ? 'Aún no tienes historias clínicas registradas'
                      : 'No hay historias clínicas disponibles'
                  }
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface HistoriaDetailProps {
  historia: HistoriaClinica;
  onBack: () => void;
  userRole: string;
}

const HistoriaDetail: React.FC<HistoriaDetailProps> = ({ historia, onBack, userRole }) => {
  const [serviciosMedicos, setServiciosMedicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServiciosMedicos();
  }, [historia.id_historia]);

  const fetchServiciosMedicos = async () => {
    try {
      // Obtener servicios médicos relacionados con esta historia clínica
      const { data: pacientes } = await supabase
        .from('paciente')
        .select('id_paciente')
        .eq('id_historia', historia.id_historia);

      if (pacientes && pacientes.length > 0) {
        const pacienteIds = pacientes.map(p => p.id_paciente);
        
        const { data: citas } = await supabase
          .from('cita_medica')
          .select(`
            id_cita_medica,
            fecha_hora_programada,
            estado,
            personal_medico:id_personal_medico (
              persona:id_persona (
                prenombres,
                primer_apellido,
                segundo_apellido
              ),
              especialidad:id_especialidad (
                descripcion
              )
            ),
            servicio_medico (
              id_servicio_medico,
              fecha_servicio,
              hora_inicio_servicio,
              hora_fin_servicio
            )
          `)
          .in('id_paciente', pacienteIds)
          .order('fecha_hora_programada', { ascending: false });

        setServiciosMedicos(citas || []);
      }
    } catch (error) {
      console.error('Error fetching servicios médicos:', error);
    } finally {
      setLoading(false);
    }
  };

  const pacienteInfo = historia.paciente[0]?.persona;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={onBack}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <span className="mr-1">←</span> Volver
          </button>
          <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${
            getStatusColor(historia.estado_historia_clinica?.nombre_estado)
          }`}>
            {historia.estado_historia_clinica?.nombre_estado}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {pacienteInfo ? 
                `${pacienteInfo.prenombres} ${pacienteInfo.primer_apellido} ${pacienteInfo.segundo_apellido}` :
                'Información del paciente no disponible'
              }
            </h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Documento:</span> {pacienteInfo?.dni_idcarnet}</p>
              <p><span className="font-medium">Fecha de nacimiento:</span> {pacienteInfo?.fecha_nacimiento}</p>
              <p><span className="font-medium">Sexo:</span> {pacienteInfo?.sexo}</p>
              <p><span className="font-medium">Teléfono:</span> {pacienteInfo?.numero_celular_personal}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">Información Médica</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Grupo sanguíneo:</span> {historia.perfil_medico?.grupo_sanguineo || 'No especificado'}</p>
              <p><span className="font-medium">Ambiente de residencia:</span> {historia.perfil_medico?.ambiente_residencia || 'No especificado'}</p>
              <p><span className="font-medium">Historia creada:</span> {new Date(historia.fecha_creacion).toLocaleDateString('es-ES')}</p>
              <p><span className="font-medium">Última atención:</span> {historia.perfil_medico?.fecha_atencion ? new Date(historia.perfil_medico.fecha_atencion).toLocaleDateString('es-ES') : 'Sin registro'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Servicios médicos */}
      <div className="p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
          <Stethoscope className="h-5 w-5 mr-2" />
          Servicios Médicos
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando servicios...</span>
          </div>
        ) : serviciosMedicos.length > 0 ? (
          <div className="space-y-4">
            {serviciosMedicos.map((cita) => (
              <div key={cita.id_cita_medica} className="border border-gray-200 rounded-md p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-800">
                      {cita.personal_medico?.especialidad?.descripcion || 'Consulta General'}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Dr. {cita.personal_medico?.persona ? 
                        `${cita.personal_medico.persona.prenombres} ${cita.personal_medico.persona.primer_apellido}` :
                        'Médico no especificado'
                      }
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    cita.estado === 'Completada' ? 'bg-green-100 text-green-800' :
                    cita.estado === 'Programada' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {cita.estado}
                  </span>
                </div>
                
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>{new Date(cita.fecha_hora_programada).toLocaleDateString('es-ES')}</span>
                  <Clock className="h-4 w-4 ml-4 mr-1" />
                  <span>{new Date(cita.fecha_hora_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {cita.servicio_medico && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p><span className="font-medium">Servicio realizado:</span> {new Date(cita.servicio_medico.fecha_servicio).toLocaleDateString('es-ES')}</p>
                    <p><span className="font-medium">Duración:</span> {cita.servicio_medico.hora_inicio_servicio} - {cita.servicio_medico.hora_fin_servicio}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p>No hay servicios médicos registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Función auxiliar para obtener el color del estado (movida fuera del componente)
const getStatusColor = (estado: string) => {
  switch (estado?.toLowerCase()) {
    case 'activa':
      return 'bg-green-100 text-green-800';
    case 'inactiva':
      return 'bg-red-100 text-red-800';
    case 'en revisión':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default MedicalRecords;