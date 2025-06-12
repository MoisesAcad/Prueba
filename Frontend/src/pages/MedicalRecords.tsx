import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  ChevronRight,
  AlertCircle,
  Clock,
  Stethoscope,
  Eye,
  Download,
  Plus
} from 'lucide-react';

// Tipos de datos
interface HistoriaClinica {
  id_historia: number;
  fecha_creacion: string;
  estado: string;
  persona: {
    id_persona: number;
    prenombres: string;
    primer_apellido: string;
    segundo_apellido: string;
    dni_idcarnet: string;
    fecha_nacimiento: string;
    sexo: string;
  };
  perfil_medico: {
    grupo_sanguineo?: string;
    ambiente_residencia?: string;
    orientacion_sexual?: string;
    vida_sexual_activa?: boolean;
  };
}

interface ServicioMedico {
  id_servicio_medico: number;
  fecha_servicio: string;
  hora_inicio_servicio: string;
  hora_fin_servicio: string;
  cita_medica: {
    personal_medico: {
      persona: {
        prenombres: string;
        primer_apellido: string;
        segundo_apellido: string;
      };
      especialidad: {
        descripcion: string;
      };
    };
  };
  consulta_medica?: {
    motivo_consulta?: string;
    observaciones_generales?: string;
    tipo_servicio: {
      nombre: string;
    };
    subtipo_servicio: {
      nombre: string;
    };
  }[];
  diagnostico?: {
    detalle?: string;
    morbilidad: {
      descripcion: string;
      cie10: {
        codigo: string;
        descripcion: string;
      };
    };
  }[];
  tratamiento?: {
    razon?: string;
    observaciones?: string;
    duracion_cantidad?: number;
    unidad_tiempo: {
      nombre: string;
    };
    tratamiento_medicamento?: {
      medicamento: {
        nombre_comercial: string;
        concentracion?: string;
      };
      cantidad_dosis: number;
      frecuencia: string;
    }[];
  }[];
  examen?: {
    descripcion_procedimiento?: string;
    resultado?: string;
    tipo_procedimiento?: string;
  }[];
}

const MedicalRecords: React.FC = () => {
  return (
    <div className="container mx-auto">
      <Routes>
        <Route path="/" element={<MedicalRecordsList />} />
        <Route path="/:id" element={<MedicalRecordDetail />} />
      </Routes>
    </div>
  );
};

const MedicalRecordsList: React.FC = () => {
  const { user } = useUser();
  const [historias, setHistorias] = useState<HistoriaClinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchHistoriasClinicas();
    }
  }, [user]);

  const fetchHistoriasClinicas = async () => {
    try {
      setLoading(true);
      setError('');

      let query = supabase
        .from('historia_clinica')
        .select(`
          id_historia,
          fecha_creacion,
          estado_historia_clinica!inner(nombre_estado),
          perfil_medico!inner(
            id_perfil_medico,
            grupo_sanguineo,
            ambiente_residencia,
            orientacion_sexual,
            vida_sexual_activa
          )
        `);

      let personasIds: number[] = [];

      if (user.currentRole === 'patient') {
        // Para pacientes: obtener IDs de personas relacionadas (usuario + familiares)
        personasIds = user.profiles.map(profile => parseInt(profile.id));
      } else if (user.currentRole === 'medical') {
        // Para médicos: obtener IDs de pacientes que han atendido
        const { data: citasData, error: citasError } = await supabase
          .from('cita_medica')
          .select(`
            paciente!inner(
              persona!inner(id_persona)
            )
          `)
          .eq('personal_medico.persona.id_persona', parseInt(user.currentProfileId));

        if (citasError) throw citasError;

        personasIds = citasData?.map((cita: any) => cita.paciente.persona.id_persona) || [];
        
        // Eliminar duplicados
        personasIds = [...new Set(personasIds)];
      } else if (user.currentRole === 'admin') {
        // Para administradores: acceso a todas las historias
        // No aplicamos filtro de personas
      }

      // Obtener datos de personas para relacionar con perfiles médicos
      let personasQuery = supabase
        .from('persona')
        .select(`
          id_persona,
          prenombres,
          primer_apellido,
          segundo_apellido,
          dni_idcarnet,
          fecha_nacimiento,
          sexo,
          paciente!inner(
            id_historia
          )
        `);

      if (user.currentRole !== 'admin' && personasIds.length > 0) {
        personasQuery = personasQuery.in('id_persona', personasIds);
      }

      const { data: personasData, error: personasError } = await personasQuery;
      if (personasError) throw personasError;

      // Crear mapa de id_historia -> persona
      const historiaPersonaMap = new Map();
      personasData?.forEach((persona: any) => {
        if (persona.paciente && persona.paciente.length > 0) {
          persona.paciente.forEach((paciente: any) => {
            historiaPersonaMap.set(paciente.id_historia, persona);
          });
        }
      });

      // Obtener historias clínicas
      if (user.currentRole !== 'admin' && personasIds.length === 0) {
        // Si no hay personas relacionadas, no mostrar historias
        setHistorias([]);
        return;
      }

      const { data: historiasData, error: historiasError } = await query;
      if (historiasError) throw historiasError;

      // Combinar datos de historias con personas
      const historiasConPersonas: HistoriaClinica[] = (historiasData || [])
        .map((historia: any) => {
          const persona = historiaPersonaMap.get(historia.id_historia);
          if (!persona && user.currentRole !== 'admin') {
            return null; // Filtrar historias sin persona asociada para no-admin
          }

          return {
            id_historia: historia.id_historia,
            fecha_creacion: historia.fecha_creacion,
            estado: historia.estado_historia_clinica?.nombre_estado || 'Desconocido',
            persona: persona || {
              id_persona: 0,
              prenombres: 'Sin',
              primer_apellido: 'Información',
              segundo_apellido: 'Personal',
              dni_idcarnet: '00000000',
              fecha_nacimiento: '1900-01-01',
              sexo: 'M'
            },
            perfil_medico: {
              grupo_sanguineo: historia.perfil_medico?.grupo_sanguineo,
              ambiente_residencia: historia.perfil_medico?.ambiente_residencia,
              orientacion_sexual: historia.perfil_medico?.orientacion_sexual,
              vida_sexual_activa: historia.perfil_medico?.vida_sexual_activa
            }
          };
        })
        .filter(Boolean) as HistoriaClinica[];

      setHistorias(historiasConPersonas);
    } catch (error: any) {
      console.error('Error fetching historias clínicas:', error);
      setError('Error al cargar las historias clínicas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar historias según búsqueda y estado
  const filteredHistorias = historias.filter(historia => {
    const matchesSearch = searchTerm === '' || 
      `${historia.persona.prenombres} ${historia.persona.primer_apellido} ${historia.persona.segundo_apellido}`
        .toLowerCase().includes(searchTerm.toLowerCase()) ||
      historia.persona.dni_idcarnet.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || historia.estado.toLowerCase() === filterStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
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

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Debe iniciar sesión para ver las historias clínicas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Historias Clínicas</h1>
          <p className="text-gray-600 mt-1">
            {user.currentRole === 'patient' && 'Gestiona tu historial médico y el de tu familia'}
            {user.currentRole === 'medical' && 'Historias clínicas de tus pacientes'}
            {user.currentRole === 'admin' && 'Gestión completa de historias clínicas'}
          </p>
        </div>
        
        {user.currentRole === 'medical' && (
          <button className="mt-4 md:mt-0 flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            <Plus size={18} className="mr-2" />
            Nueva Historia
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1 relative">
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
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-gray-400 mr-2" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos los estados</option>
                <option value="activa">Activa</option>
                <option value="inactiva">Inactiva</option>
                <option value="en revisión">En revisión</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historias clínicas...</p>
        </div>
      ) : filteredHistorias.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">
            {searchTerm || filterStatus !== 'all' 
              ? 'No se encontraron historias clínicas' 
              : 'No hay historias clínicas disponibles'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || filterStatus !== 'all'
              ? 'Intenta ajustar los filtros de búsqueda.'
              : user.currentRole === 'patient' 
                ? 'Aún no tienes historias clínicas registradas.'
                : user.currentRole === 'medical'
                ? 'No tienes pacientes asignados con historias clínicas.'
                : 'No hay historias clínicas en el sistema.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                    Edad
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha Creación
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredHistorias.map((historia) => (
                  <tr key={historia.id_historia} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="h-6 w-6 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {`${historia.persona.prenombres} ${historia.persona.primer_apellido} ${historia.persona.segundo_apellido}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            {historia.persona.sexo === 'M' ? 'Masculino' : 'Femenino'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{historia.persona.dni_idcarnet}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {calculateAge(historia.persona.fecha_nacimiento)} años
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(historia.fecha_creacion).toLocaleDateString('es-ES')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(historia.estado)}`}>
                        {historia.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          to={`/medical-records/${historia.id_historia}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <Eye size={16} className="mr-1" />
                          Ver
                        </Link>
                        <button className="text-gray-600 hover:text-gray-800 flex items-center">
                          <Download size={16} className="mr-1" />
                          Exportar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const MedicalRecordDetail: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();
  const [historia, setHistoria] = useState<HistoriaClinica | null>(null);
  const [servicios, setServicios] = useState<ServicioMedico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'general' | 'servicios' | 'diagnosticos' | 'tratamientos'>('general');

  const historiaId = location.pathname.split('/').pop();

  useEffect(() => {
    if (historiaId && user) {
      fetchHistoriaDetail();
    }
  }, [historiaId, user]);

  const fetchHistoriaDetail = async () => {
    try {
      setLoading(true);
      setError('');

      // Obtener historia clínica con datos de persona
      const { data: historiaData, error: historiaError } = await supabase
        .from('historia_clinica')
        .select(`
          id_historia,
          fecha_creacion,
          estado_historia_clinica!inner(nombre_estado),
          perfil_medico!inner(
            grupo_sanguineo,
            ambiente_residencia,
            orientacion_sexual,
            vida_sexual_activa
          ),
          paciente!inner(
            persona!inner(
              id_persona,
              prenombres,
              primer_apellido,
              segundo_apellido,
              dni_idcarnet,
              fecha_nacimiento,
              sexo,
              direccion_legal,
              correo_electronico,
              numero_celular_personal
            )
          )
        `)
        .eq('id_historia', historiaId)
        .single();

      if (historiaError) throw historiaError;

      // Verificar permisos de acceso
      const personaId = historiaData.paciente.persona.id_persona;
      let hasAccess = false;

      if (user.currentRole === 'admin') {
        hasAccess = true;
      } else if (user.currentRole === 'patient') {
        // Verificar si es el usuario o un familiar
        hasAccess = user.profiles.some(profile => parseInt(profile.id) === personaId);
      } else if (user.currentRole === 'medical') {
        // Verificar si el médico ha atendido a este paciente
        const { data: citasData, error: citasError } = await supabase
          .from('cita_medica')
          .select('id_cita_medica')
          .eq('paciente.persona.id_persona', personaId)
          .eq('personal_medico.persona.id_persona', parseInt(user.currentProfileId));

        if (!citasError && citasData && citasData.length > 0) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        throw new Error('No tiene permisos para acceder a esta historia clínica');
      }

      // Transformar datos de historia
      const historiaTransformada: HistoriaClinica = {
        id_historia: historiaData.id_historia,
        fecha_creacion: historiaData.fecha_creacion,
        estado: historiaData.estado_historia_clinica.nombre_estado,
        persona: historiaData.paciente.persona,
        perfil_medico: historiaData.perfil_medico
      };

      setHistoria(historiaTransformada);

      // Obtener servicios médicos relacionados
      await fetchServiciosMedicos(historiaId);

    } catch (error: any) {
      console.error('Error fetching historia detail:', error);
      setError('Error al cargar la historia clínica: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiciosMedicos = async (historiaId: string) => {
    try {
      const { data: serviciosData, error: serviciosError } = await supabase
        .from('servicio_medico')
        .select(`
          id_servicio_medico,
          fecha_servicio,
          hora_inicio_servicio,
          hora_fin_servicio,
          cita_medica!inner(
            personal_medico!inner(
              persona!inner(
                prenombres,
                primer_apellido,
                segundo_apellido
              ),
              especialidad!inner(
                descripcion
              )
            ),
            paciente!inner(
              id_historia
            )
          ),
          consulta_medica(
            motivo_consulta,
            observaciones_generales,
            tipo_servicio!inner(nombre),
            subtipo_servicio!inner(nombre)
          ),
          diagnostico(
            detalle,
            morbilidad!inner(
              descripcion,
              cie10!inner(
                codigo,
                descripcion
              )
            )
          ),
          tratamiento(
            razon,
            observaciones,
            duracion_cantidad,
            unidad_tiempo!inner(nombre),
            tratamiento_medicamento(
              cantidad_dosis,
              frecuencia,
              medicamento!inner(
                nombre_comercial,
                concentracion
              )
            )
          ),
          examen(
            descripcion_procedimiento,
            resultado,
            tipo_procedimiento
          )
        `)
        .eq('cita_medica.paciente.id_historia', historiaId)
        .order('fecha_servicio', { ascending: false });

      if (serviciosError) throw serviciosError;

      setServicios(serviciosData || []);
    } catch (error: any) {
      console.error('Error fetching servicios médicos:', error);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando historia clínica...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-6">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            to="/medical-records"
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            ← Volver a historias clínicas
          </Link>
        </div>
      </div>
    );
  }

  if (!historia) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Historia clínica no encontrada</p>
        <Link
          to="/medical-records"
          className="mt-4 inline-block text-blue-600 hover:text-blue-800"
        >
          ← Volver a historias clínicas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/medical-records"
            className="text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Volver
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              Historia Clínica #{historia.id_historia}
            </h1>
            <p className="text-gray-600">
              {`${historia.persona.prenombres} ${historia.persona.primer_apellido} ${historia.persona.segundo_apellido}`}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
            <Download size={18} className="mr-2" />
            Exportar PDF
          </button>
          {user.currentRole === 'medical' && (
            <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              <Plus size={18} className="mr-2" />
              Nuevo Servicio
            </button>
          )}
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
              <User className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                {`${historia.persona.prenombres} ${historia.persona.primer_apellido} ${historia.persona.segundo_apellido}`}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">DNI:</span> {historia.persona.dni_idcarnet}
                </div>
                <div>
                  <span className="font-medium">Edad:</span> {calculateAge(historia.persona.fecha_nacimiento)} años
                </div>
                <div>
                  <span className="font-medium">Sexo:</span> {historia.persona.sexo === 'M' ? 'Masculino' : 'Femenino'}
                </div>
                <div>
                  <span className="font-medium">Grupo Sanguíneo:</span> {historia.perfil_medico.grupo_sanguineo || 'No especificado'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
              historia.estado === 'Activa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {historia.estado}
            </span>
            <p className="text-sm text-gray-500 mt-1">
              Creada: {new Date(historia.fecha_creacion).toLocaleDateString('es-ES')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'general', label: 'Información General', icon: User },
              { id: 'servicios', label: 'Servicios Médicos', icon: Stethoscope },
              { id: 'diagnosticos', label: 'Diagnósticos', icon: FileText },
              { id: 'tratamientos', label: 'Tratamientos', icon: Calendar }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={18} className="mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Datos Personales</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Dirección</label>
                      <p className="text-sm text-gray-900">{historia.persona.direccion_legal || 'No especificada'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                      <p className="text-sm text-gray-900">{historia.persona.correo_electronico || 'No especificado'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                      <p className="text-sm text-gray-900">{historia.persona.numero_celular_personal || 'No especificado'}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Información Médica</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ambiente de Residencia</label>
                      <p className="text-sm text-gray-900">{historia.perfil_medico.ambiente_residencia || 'No especificado'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Orientación Sexual</label>
                      <p className="text-sm text-gray-900">{historia.perfil_medico.orientacion_sexual || 'No especificada'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vida Sexual Activa</label>
                      <p className="text-sm text-gray-900">
                        {historia.perfil_medico.vida_sexual_activa === null 
                          ? 'No especificado' 
                          : historia.perfil_medico.vida_sexual_activa ? 'Sí' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'servicios' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-800">Servicios Médicos</h3>
                <span className="text-sm text-gray-500">{servicios.length} servicios registrados</span>
              </div>
              
              {servicios.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay servicios médicos registrados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {servicios.map((servicio) => (
                    <div key={servicio.id_servicio_medico} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-800">
                            {servicio.consulta_medica?.[0]?.tipo_servicio?.nombre || 'Servicio Médico'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Dr. {`${servicio.cita_medica.personal_medico.persona.prenombres} ${servicio.cita_medica.personal_medico.persona.primer_apellido}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {servicio.cita_medica.personal_medico.especialidad.descripcion}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-800">
                            {new Date(servicio.fecha_servicio).toLocaleDateString('es-ES')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {servicio.hora_inicio_servicio} - {servicio.hora_fin_servicio}
                          </p>
                        </div>
                      </div>
                      
                      {servicio.consulta_medica?.[0]?.motivo_consulta && (
                        <div className="mb-2">
                          <span className="text-sm font-medium text-gray-700">Motivo: </span>
                          <span className="text-sm text-gray-600">{servicio.consulta_medica[0].motivo_consulta}</span>
                        </div>
                      )}
                      
                      {servicio.consulta_medica?.[0]?.observaciones_generales && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Observaciones: </span>
                          <span className="text-sm text-gray-600">{servicio.consulta_medica[0].observaciones_generales}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnosticos' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">Diagnósticos</h3>
              
              {servicios.filter(s => s.diagnostico && s.diagnostico.length > 0).length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay diagnósticos registrados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {servicios.map((servicio) => 
                    servicio.diagnostico?.map((diagnostico, index) => (
                      <div key={`${servicio.id_servicio_medico}-${index}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-gray-800">{diagnostico.morbilidad.descripcion}</h4>
                            <p className="text-sm text-gray-600">
                              CIE-10: {diagnostico.morbilidad.cie10.codigo} - {diagnostico.morbilidad.cie10.descripcion}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(servicio.fecha_servicio).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        {diagnostico.detalle && (
                          <p className="text-sm text-gray-600 mt-2">{diagnostico.detalle}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tratamientos' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">Tratamientos</h3>
              
              {servicios.filter(s => s.tratamiento && s.tratamiento.length > 0).length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay tratamientos registrados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {servicios.map((servicio) => 
                    servicio.tratamiento?.map((tratamiento, index) => (
                      <div key={`${servicio.id_servicio_medico}-${index}`} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-800">Tratamiento</h4>
                            {tratamiento.razon && (
                              <p className="text-sm text-gray-600">Razón: {tratamiento.razon}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-gray-500">
                              {new Date(servicio.fecha_servicio).toLocaleDateString('es-ES')}
                            </span>
                            {tratamiento.duracion_cantidad && (
                              <p className="text-sm text-gray-600">
                                Duración: {tratamiento.duracion_cantidad} {tratamiento.unidad_tiempo.nombre}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {tratamiento.tratamiento_medicamento && tratamiento.tratamiento_medicamento.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Medicamentos:</h5>
                            <div className="space-y-2">
                              {tratamiento.tratamiento_medicamento.map((med, medIndex) => (
                                <div key={medIndex} className="bg-gray-50 p-3 rounded">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-medium text-gray-800">{med.medicamento.nombre_comercial}</p>
                                      {med.medicamento.concentracion && (
                                        <p className="text-sm text-gray-600">Concentración: {med.medicamento.concentracion}</p>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-gray-600">Dosis: {med.cantidad_dosis}</p>
                                      <p className="text-sm text-gray-600">Frecuencia: {med.frecuencia}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {tratamiento.observaciones && (
                          <div className="mt-3">
                            <span className="text-sm font-medium text-gray-700">Observaciones: </span>
                            <span className="text-sm text-gray-600">{tratamiento.observaciones}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalRecords;