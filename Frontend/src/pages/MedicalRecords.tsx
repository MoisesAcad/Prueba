import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import {
  Search,
  FileText,
  Download,
  Filter,
  ChevronRight,
  Calendar,
  Pill,
  Clipboard,
  Stethoscope,
  Heart,
  Activity,
  TestTube,
  Scissors,
  Bed,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Phone,
  MapPin,
  Droplet,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

// Tipos de datos
interface HistoriaClinica {
  id_historia: number;
  id_estado: number;
  id_perfil_medico: number;
  fecha_creacion: string;
  estado_historia_clinica?: {
    nombre_estado: string;
    descripcion: string;
  };
  perfil_medico?: PerfilMedico;
}

interface PerfilMedico {
  id_perfil_medico: number;
  fecha_atencion: string;
  grupo_sanguineo?: string;
  ambiente_residencia?: string;
  orientacion_sexual?: string;
  vida_sexual_activa?: boolean;
  perfil_alergias?: PerfilAlergia[];
}

interface PerfilAlergia {
  id_perfil_alergias: number;
  alergia?: {
    nombre_alergia: string;
    componente_alergeno: string;
  };
}

interface ServicioMedico {
  id_servicio_medico: number;
  fecha_servicio: string;
  hora_inicio_servicio: string;
  hora_fin_servicio: string;
  cita_medica?: {
    id_paciente: number;
    estado: string;
    fecha_hora_programada: string;
    personal_medico?: {
      persona?: {
        prenombres: string;
        primer_apellido: string;
        segundo_apellido: string;
      };
      especialidad?: {
        descripcion: string;
      };
    };
  };
  consulta_medica?: ConsultaMedica[];
  diagnostico?: Diagnostico[];
  tratamiento?: Tratamiento[];
  examen?: Examen[];
  terapia?: Terapia[];
  intervencion_quirurgica?: IntervencionQuirurgica[];
  control?: Control[];
  ingreso_hospitalizacion?: IngresoHospitalizacion[];
  alta_hospitalizacion?: AltaHospitalizacion[];
}

interface ConsultaMedica {
  id_consulta_medica: number;
  observaciones_generales?: string;
  motivo_consulta?: string;
  tipo_servicio?: {
    nombre: string;
  };
  subtipo_servicio?: {
    nombre: string;
  };
}

interface Diagnostico {
  id_diagnostico: number;
  detalle?: string;
  morbilidad?: {
    descripcion?: string;
    fecha_identificacion?: string;
    tipo: string;
    nivel_gravedad?: string;
    contagiosa?: boolean;
    cie10?: {
      codigo?: string;
      descripcion?: string;
    };
  };
  sintoma?: Sintoma[];
}

interface Sintoma {
  id_sintoma: number;
  nombre_sintoma: string;
  fecha_primera_manifestacion: string;
  descripcion?: string;
  severidad: number;
  estado_actual: string;
}

interface Tratamiento {
  id_tratamiento: number;
  razon?: string;
  duracion_cantidad?: number;
  observaciones?: string;
  unidad_tiempo?: {
    nombre?: string;
  };
  tratamiento_medicamento?: TratamientoMedicamento[];
}

interface TratamientoMedicamento {
  id_tratamiento_medicamento: number;
  motivo?: string;
  cantidad_dosis: number;
  frecuencia: string;
  medicamento?: {
    nombre_comercial: string;
    metodo_administracion?: string;
    concentracion?: string;
    laboratorio: string;
  };
}

interface Examen {
  id_examen: number;
  descripcion_procedimiento?: string;
  fecha_hora_atencion: string;
  descripcion?: string;
  tipo_procedimiento?: string;
  tipo_laboratorio?: string;
  resultado?: string;
}

interface Terapia {
  id_terapia: number;
  descripcion?: string;
  observaciones?: string;
  resultados?: string;
}

interface IntervencionQuirurgica {
  id_intervencion: number;
  procedimiento_quirurgico?: string;
  tipo_anestesia?: string;
  observaciones?: string;
}

interface Control {
  id_control: number;
  pulso_cardiaco: number;
  presion_diastolica: number;
  presion_sistolica: number;
  oxigenacion: number;
  estado_paciente?: string;
  observaciones?: string;
}

interface IngresoHospitalizacion {
  id_ingreso_hospitalizacion: number;
  razon_ingreso?: string;
  atenciones_necesarias?: string;
  fecha_estimada_alta?: string;
  nro_camas?: number;
}

interface AltaHospitalizacion {
  id_alta_hospitalizacion: number;
  indicaciones_postalta?: string;
  motivo_alta?: string;
}

interface PersonaInfo {
  id_persona: number;
  prenombres: string;
  primer_apellido: string;
  segundo_apellido: string;
  dni_idcarnet: string;
  sexo: string;
  fecha_nacimiento: string;
  direccion_legal: string;
  correo_electronico?: string;
  numero_celular_personal?: string;
  numero_celular_emergencia?: string;
}

const MedicalRecords: React.FC = () => {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historias, setHistorias] = useState<HistoriaClinica[]>([]);
  const [personasInfo, setPersonasInfo] = useState<{ [key: number]: PersonaInfo }>({});

  if (!user) return null;

  // Función para obtener información de personas
  const obtenerPersonasInfo = async (personaIds: number[]) => {
    try {
      console.log('Obteniendo información de personas:', personaIds);

      const { data, error } = await supabase
          .from('persona')
          .select('*')
          .in('id_persona', personaIds);

      if (error) {
        console.error('Error obteniendo personas:', error);
        throw error;
      }

      console.log('Personas obtenidas:', data);

      const personasMap: { [key: number]: PersonaInfo } = {};
      data?.forEach(persona => {
        personasMap[persona.id_persona] = persona;
      });
      console.log('Personas obtenidas:', personasMap);
      return personasMap;
    } catch (error) {
      console.error('Error en obtenerPersonasInfo:', error);
      throw error;
    }
  };

  // Función para obtener historias clínicas según el rol
  const obtenerHistoriasClinicas = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Iniciando carga de historias clínicas para usuario:', user);

      let historiasData: HistoriaClinica[] = [];
      let personaIds: number[] = [];

      switch (user.currentRole) {
        case 'patient':
          console.log('Cargando historias para paciente');
          // Obtener IDs de personas relacionadas (usuario + familiares)
          personaIds = user.profiles.map(profile => parseInt(profile.id));
          console.log('IDs de personas a consultar:', personaIds);
          break;

        case 'admin':
          console.log('Cargando todas las historias para administrador');
          // Los administradores pueden ver todas las historias
          const { data: todasHistorias, error: errorAdmin } = await supabase
              .from('historia_clinica')
              .select(`
              *,
              estado_historia_clinica:id_estado (
                nombre_estado,
                descripcion
              ),
              perfil_medico:id_perfil_medico (
                *,
                perfil_alergias (
                  *,
                  alergia:id_alergia (
                    nombre_alergia,
                    componente_alergeno
                  )
                )
              )
            `)
              .order('fecha_creacion', { ascending: false });

          if (errorAdmin) {
            console.error('Error obteniendo historias para admin:', errorAdmin);
            throw errorAdmin;
          }

          historiasData = todasHistorias || [];
          console.log('Historias obtenidas para admin:', historiasData.length);

          // Para admin, necesitamos obtener todas las personas que tienen historias
          const { data: pacientes, error: errorPacientes } = await supabase
              .from('paciente')
              .select('id_persona, id_historia')
              .in('id_historia', historiasData.map(h => h.id_historia));

          if (errorPacientes) {
            console.error('Error obteniendo pacientes:', errorPacientes);
            throw errorPacientes;
          }

          personaIds = pacientes?.map(p => p.id_persona) || [];
          break;

        case 'medical':
          console.log('Cargando historias para personal médico');
          // El personal médico puede ver historias de sus pacientes
          // Por ahora, mostraremos todas (esto se puede refinar según las citas asignadas)
          const { data: historiasPersonalMedico, error: errorMedico } = await supabase
              .from('historia_clinica')
              .select(`
              *,
              estado_historia_clinica:id_estado (
                nombre_estado,
                descripcion
              ),
              perfil_medico:id_perfil_medico (
                *,
                perfil_alergias (
                  *,
                  alergia:id_alergia (
                    nombre_alergia,
                    componente_alergeno
                  )
                )
              )
            `)
              .order('fecha_creacion', { ascending: false });

          if (errorMedico) {
            console.error('Error obteniendo historias para médico:', errorMedico);
            throw errorMedico;
          }

          historiasData = historiasPersonalMedico || [];

          // Obtener personas relacionadas con estas historias
          const { data: pacientesMedico, error: errorPacientesMedico } = await supabase
              .from('paciente')
              .select('id_persona, id_historia')
              .in('id_historia', historiasData.map(h => h.id_historia));

          if (errorPacientesMedico) {
            console.error('Error obteniendo pacientes para médico:', errorPacientesMedico);
            throw errorPacientesMedico;
          }

          personaIds = pacientesMedico?.map(p => p.id_persona) || [];
          break;

        default:
          throw new Error('Rol de usuario no reconocido');
      }

      // Para pacientes, necesitamos obtener las historias específicas
      if (user.currentRole === 'patient') {
        console.log('Obteniendo historias específicas para paciente');

        // Primero obtener los pacientes relacionados con estas personas
        const { data: pacientesRelacionados, error: errorPacientesRel } = await supabase
            .from('paciente')
            .select('id_historia, id_persona')
            .in('id_persona', personaIds);

        if (errorPacientesRel) {
          console.error('Error obteniendo pacientes relacionados:', errorPacientesRel);
          throw errorPacientesRel;
        }

        console.log('Pacientes relacionados:', pacientesRelacionados);

        if (pacientesRelacionados && pacientesRelacionados.length > 0) {
          const historiaIds = pacientesRelacionados.map(p => p.id_historia);

          const { data: historiasEspecificas, error: errorHistoriasEsp } = await supabase
              .from('historia_clinica')
              .select(`
              *,
              estado_historia_clinica:id_estado (
                nombre_estado,
                descripcion
              ),
              perfil_medico:id_perfil_medico (
                *,
                perfil_alergias (
                  *,
                  alergia:id_alergia (
                    nombre_alergia,
                    componente_alergeno
                  )
                )
              )
            `)
              .in('id_historia', historiaIds)
              .order('fecha_creacion', { ascending: false });

          if (errorHistoriasEsp) {
            console.error('Error obteniendo historias específicas:', errorHistoriasEsp);
            throw errorHistoriasEsp;
          }

          historiasData = historiasEspecificas || [];
        }
      }

      console.log('Historias obtenidas:', historiasData.length);

      // Obtener información de las personas
      if (personaIds.length > 0) {
        const personasMap = await obtenerPersonasInfo(personaIds);
        setPersonasInfo(personasMap);
      }

      setHistorias(historiasData);

    } catch (error) {
      console.error('Error completo al cargar historias clínicas:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido al cargar las historias clínicas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      obtenerHistoriasClinicas();
    }
  }, [user]);

  // Filtrar historias según el término de búsqueda
  const filteredRecords = historias.filter(historia => {
    if (!searchTerm) return true;

    // Buscar en la información de la persona asociada
    const pacienteInfo = Object.values(personasInfo).find(persona => {
      // Aquí necesitaríamos relacionar la historia con la persona
      // Por simplicidad, buscaremos en todos los nombres
      const nombreCompleto = `${persona.prenombres} ${persona.primer_apellido} ${persona.segundo_apellido}`.toLowerCase();
      return nombreCompleto.includes(searchTerm.toLowerCase()) ||
          persona.dni_idcarnet.includes(searchTerm);
    });

    return !!pacienteInfo;
  });

  if (loading) {
    return (
        <div className="container mx-auto">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Cargando historias clínicas...</span>
          </div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="container mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error al cargar las historias clínicas</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <button
                      onClick={obtenerHistoriasClinicas}
                      className="mt-2 text-sm underline hover:no-underline"
                  >
                    Intentar nuevamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
    );
  }

  // Obtener contenido según el rol
  let content: React.ReactNode = null;

  switch (user.currentRole) {
    case 'patient':
      content = <PatientMedicalRecords
          records={filteredRecords}
          personasInfo={personasInfo}
          selectedRecord={selectedRecord}
          setSelectedRecord={setSelectedRecord}
      />;
      break;
    case 'admin':
      content = <AdminMedicalRecords
          records={filteredRecords}
          personasInfo={personasInfo}
      />;
      break;
    case 'medical':
      content = <MedicalPersonnelRecords
          records={filteredRecords}
          personasInfo={personasInfo}
          selectedRecord={selectedRecord}
          setSelectedRecord={setSelectedRecord}
      />;
      break;
    default:
      content = <PatientMedicalRecords
          records={filteredRecords}
          personasInfo={personasInfo}
          selectedRecord={selectedRecord}
          setSelectedRecord={setSelectedRecord}
      />;
  }

  return (
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Historias Clínicas</h1>

          <div className="relative flex items-center">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                  type="text"
                  placeholder="Buscar historia clínica..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-60 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {content}
      </div>
  );
};

interface RecordProps {
  records: HistoriaClinica[];
  personasInfo: { [key: number]: PersonaInfo };
  selectedRecord?: string | null;
  setSelectedRecord?: (id: string | null) => void;
}

const PatientMedicalRecords: React.FC<RecordProps> = ({ records, personasInfo, selectedRecord, setSelectedRecord }) => {
  return (
      <div className="bg-white rounded-lg shadow-sm">
        {selectedRecord ? (
            <MedicalRecordDetail
                recordId={selectedRecord}
                onBack={() => setSelectedRecord?.(null)}
                personasInfo={personasInfo}
            />
        ) : (
            <div className="p-6">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-800">Mis Historias Clínicas</h2>
              </div>

              <div className="space-y-4">
                {records.length > 0 ? (
                    records.map((record) => {
                      // Encontrar la persona asociada a esta historia
                      const persona = Object.values(personasInfo)[0]; // Simplificado por ahora
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
        )}
      </div>
  );
};

const AdminMedicalRecords: React.FC<RecordProps> = ({ records, personasInfo }) => {
  return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-3 bg-white rounded-lg shadow-sm p-6">
          <div className="mb-4 flex flex-col md:flex-row md:justify-between md:items-center">
            <h2 className="text-lg font-medium text-gray-800 mb-2 md:mb-0">Administración de Historias Clínicas</h2>
            <div className="space-x-3">
              <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
                <Filter size={16} className="inline mr-1" />
                Filtrar
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                + Crear Nueva
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paciente
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DNI
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Creación
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => {
                const persona = Object.values(personasInfo)[0]; // Simplificado
                const nombreCompleto = persona ?
                    `${persona.prenombres} ${persona.primer_apellido} ${persona.segundo_apellido}` :
                    'Paciente';

                return (
                    <tr key={record.id_historia} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{nombreCompleto}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{persona?.dni_idcarnet || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(record.fecha_creacion).toLocaleDateString('es-ES')}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-center inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {record.estado_historia_clinica?.nombre_estado || 'Activa'}
                      </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-800 mr-3">
                          Editar
                        </button>
                        <button className="text-green-600 hover:text-green-800 mr-3">
                          Ver
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          Archivar
                        </button>
                      </td>
                    </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
};

const MedicalPersonnelRecords: React.FC<RecordProps> = ({ records, personasInfo, selectedRecord, setSelectedRecord }) => {
  return (
      <div className="bg-white rounded-lg shadow-sm">
        {selectedRecord ? (
            <MedicalRecordDetail
                recordId={selectedRecord}
                onBack={() => setSelectedRecord?.(null)}
                showTreatmentOptions={true}
                personasInfo={personasInfo}
            />
        ) : (
            <div className="p-6">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-800">Historias Clínicas de Pacientes</h2>
                <button className="flex items-center text-sm text-gray-600 hover:text-gray-800">
                  <Filter size={16} className="mr-1" />
                  Filtrar
                </button>
              </div>

              <div className="space-y-4">
                {records.length > 0 ? (
                    records.map((record) => {
                      const persona = Object.values(personasInfo)[0]; // Simplificado
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
                                <p className="text-sm text-gray-600 mt-1">
                                  DNI: {persona?.dni_idcarnet || 'N/A'} •
                                  Creada: {new Date(record.fecha_creacion).toLocaleDateString('es-ES')}
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
        )}
      </div>
  );
};

interface DetailProps {
  recordId: string;
  onBack: () => void;
  showTreatmentOptions?: boolean;
  personasInfo: { [key: number]: PersonaInfo };
}

const MedicalRecordDetail: React.FC<DetailProps> = ({ recordId, onBack, showTreatmentOptions = false, personasInfo }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historia, setHistoria] = useState<HistoriaClinica | null>(null);
  const [serviciosMedicos, setServiciosMedicos] = useState<ServicioMedico[]>([]);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  const [expandedServices, setExpandedServices] = useState<{ [key: number]: boolean }>({});

  // Obtener detalles de la historia clínica
  const obtenerDetalleHistoria = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Obteniendo detalle de historia:', recordId);

      // Obtener la historia clínica completa
      const { data: historiaData, error: errorHistoria } = await supabase
          .from('historia_clinica')
          .select(`
          *,
          estado_historia_clinica:id_estado (
            nombre_estado,
            descripcion
          ),
          perfil_medico:id_perfil_medico (
            *,
            perfil_alergias (
              *,
              alergia:id_alergia (
                nombre_alergia,
                componente_alergeno
              )
            )
          )
        `)
          .eq('id_historia', parseInt(recordId))
          .single();

      if (errorHistoria) {
        console.error('Error obteniendo historia:', errorHistoria);
        throw errorHistoria;
      }

      setHistoria(historiaData);
      console.log('Historia obtenida:', historiaData);

      // Obtener servicios médicos relacionados
      // Primero necesitamos encontrar las citas médicas del paciente
      const { data: pacienteData, error: errorPaciente } = await supabase
          .from('paciente')
          .select('id_paciente')
          .eq('id_historia', parseInt(recordId))
          .single();

      if (errorPaciente) {
        console.error('Error obteniendo paciente:', errorPaciente);
        throw errorPaciente;
      }

      console.log('Paciente encontrado:', pacienteData);

      // Obtener citas médicas del paciente
      const { data: citasData, error: errorCitas } = await supabase
          .from('cita_medica')
          .select('id_cita_medica')
          .eq('id_paciente', pacienteData.id_paciente);

      if (errorCitas) {
        console.error('Error obteniendo citas:', errorCitas);
        throw errorCitas;
      }

      console.log('Citas encontradas:', citasData);

      if (citasData && citasData.length > 0) {
        const citaIds = citasData.map(cita => cita.id_cita_medica);

        // Obtener servicios médicos con toda la información relacionada
        const { data: serviciosData, error: errorServicios } = await supabase
            .from('servicio_medico')
            .select(`
            *,
            cita_medica:id_cita_medica (
              id_paciente,
              estado,
              fecha_hora_programada,
              personal_medico:id_personal_medico (
                persona:id_persona (
                  prenombres,
                  primer_apellido,
                  segundo_apellido
                ),
                especialidad:id_especialidad (
                  descripcion
                )
              )
            )
          `)
            .in('id_cita_medica', citaIds)
            .order('fecha_servicio', { ascending: false });

        if (errorServicios) {
          console.error('Error obteniendo servicios:', errorServicios);
          throw errorServicios;
        }

        console.log('Servicios médicos obtenidos:', serviciosData);

        // Para cada servicio médico, obtener la información detallada
        const serviciosCompletos = await Promise.all(
            (serviciosData || []).map(async (servicio) => {
              const servicioCompleto = { ...servicio };

              try {
                // Obtener consultas médicas
                const { data: consultasData } = await supabase
                    .from('consulta_medica')
                    .select(`
                  *,
                  tipo_servicio:id_tipo_servicio (nombre),
                  subtipo_servicio:id_subtipo_servicio (nombre)
                `)
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.consulta_medica = consultasData || [];

                // Obtener diagnósticos
                const { data: diagnosticosData } = await supabase
                    .from('diagnostico')
                    .select(`
                  *,
                  morbilidad:id_morbilidad (
                    descripcion,
                    fecha_identificacion,
                    tipo,
                    nivel_gravedad,
                    contagiosa,
                    cie10:id_cie10 (
                      codigo,
                      descripcion
                    )
                  )
                `)
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.diagnostico = diagnosticosData || [];

                // Para cada diagnóstico, obtener síntomas
                if (diagnosticosData && diagnosticosData.length > 0) {
                  for (const diagnostico of diagnosticosData) {
                    const { data: sintomasData } = await supabase
                        .from('sintoma')
                        .select('*')
                        .eq('id_diagnostico', diagnostico.id_diagnostico);

                    diagnostico.sintoma = sintomasData || [];
                  }
                }

                // Obtener tratamientos
                const { data: tratamientosData } = await supabase
                    .from('tratamiento')
                    .select(`
                  *,
                  unidad_tiempo:id_unid_tiempo (nombre)
                `)
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.tratamiento = tratamientosData || [];

                // Para cada tratamiento, obtener medicamentos
                if (tratamientosData && tratamientosData.length > 0) {
                  for (const tratamiento of tratamientosData) {
                    const { data: medicamentosData } = await supabase
                        .from('tratamiento_medicamento')
                        .select(`
                      *,
                      medicamento:id_medicamento (
                        nombre_comercial,
                        metodo_administracion,
                        concentracion,
                        laboratorio
                      )
                    `)
                        .eq('id_tratamiento', tratamiento.id_tratamiento);

                    tratamiento.tratamiento_medicamento = medicamentosData || [];
                  }
                }

                // Obtener exámenes
                const { data: examenesData } = await supabase
                    .from('examen')
                    .select('*')
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.examen = examenesData || [];

                // Obtener terapias
                const { data: terapiasData } = await supabase
                    .from('terapia')
                    .select('*')
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.terapia = terapiasData || [];

                // Obtener intervenciones quirúrgicas
                const { data: intervencionesData } = await supabase
                    .from('intervencion_quirurgica')
                    .select('*')
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.intervencion_quirurgica = intervencionesData || [];

                // Obtener controles
                const { data: controlesData } = await supabase
                    .from('control')
                    .select('*')
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.control = controlesData || [];

                // Obtener ingresos hospitalarios
                const { data: ingresosData } = await supabase
                    .from('ingreso_hospitalizacion')
                    .select('*')
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.ingreso_hospitalizacion = ingresosData || [];

                // Obtener altas hospitalarias
                const { data: altasData } = await supabase
                    .from('alta_hospitalizacion')
                    .select('*')
                    .eq('id_servicio_medico', servicio.id_servicio_medico);

                servicioCompleto.alta_hospitalizacion = altasData || [];

              } catch (error) {
                console.error(`Error obteniendo detalles del servicio ${servicio.id_servicio_medico}:`, error);
              }

              return servicioCompleto;
            })
        );

        setServiciosMedicos(serviciosCompletos);
        console.log('Servicios médicos completos:', serviciosCompletos);
      }

    } catch (error) {
      console.error('Error obteniendo detalle de historia:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerDetalleHistoria();
  }, [recordId]);

  const toggleServiceExpansion = (serviceId: number) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  if (loading) {
    return (
        <div className="p-6">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Cargando detalles de la historia clínica...</span>
          </div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error al cargar los detalles</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <button
                      onClick={obtenerDetalleHistoria}
                      className="mt-2 text-sm underline hover:no-underline"
                  >
                    Intentar nuevamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
    );
  }

  if (!historia) {
    return (
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p>No se encontró la historia clínica</p>
          </div>
        </div>
    );
  }

  // Obtener información del paciente
  const persona = Object.values(personasInfo)[0]; // Simplificado por ahora
  const nombreCompleto = persona ?
      `${persona.prenombres} ${persona.primer_apellido} ${persona.segundo_apellido}` :
      'Paciente';

  return (
      <div className="p-6">
        <div className="mb-6">
          <button
              onClick={onBack}
              className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <span className="mr-1">←</span> Volver
          </button>
        </div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">{nombreCompleto}</h2>
            <p className="text-gray-600">Historia Clínica #{historia.id_historia}</p>
            <p className="text-sm text-gray-500">
              Estado: {historia.estado_historia_clinica?.nombre_estado || 'Activa'}
            </p>
          </div>
          <div className="flex space-x-3">
            <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              <Download size={16} className="mr-2" />
              Descargar
            </button>
            {showTreatmentOptions && (
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  <Stethoscope size={16} className="mr-2" />
                  Registrar Servicio
                </button>
            )}
          </div>
        </div>

        {/* Información del Paciente */}
        {persona && (
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-gray-800">Información del Paciente</h3>
                <button
                    onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-800"
                >
                  {showSensitiveInfo ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span className="ml-1">
                {showSensitiveInfo ? 'Ocultar' : 'Mostrar'} información sensible
              </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">DNI</p>
                    <p className="font-medium">{persona.dni_idcarnet}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Fecha de Nacimiento</p>
                    <p className="font-medium">
                      {new Date(persona.fecha_nacimiento).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-500">Sexo</p>
                    <p className="font-medium">{persona.sexo === 'M' ? 'Masculino' : 'Femenino'}</p>
                  </div>
                </div>

                {showSensitiveInfo && (
                    <>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Teléfono</p>
                          <p className="font-medium">{persona.numero_celular_personal || 'No registrado'}</p>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <p className="text-sm text-gray-500">Dirección</p>
                          <p className="font-medium">{persona.direccion_legal}</p>
                        </div>
                      </div>
                    </>
                )}

                {historia.perfil_medico?.grupo_sanguineo && (
                    <div className="flex items-center">
                      <Droplet className="h-4 w-4 text-red-500 mr-2" />
                      <div>
                        <p className="text-sm text-gray-500">Grupo Sanguíneo</p>
                        <p className="font-medium">{historia.perfil_medico.grupo_sanguineo}</p>
                      </div>
                    </div>
                )}
              </div>

              {/* Alergias */}
              {historia.perfil_medico?.perfil_alergias && historia.perfil_medico.perfil_alergias.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                      <p className="text-sm font-medium text-gray-700">Alergias</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {historia.perfil_medico.perfil_alergias.map((perfilAlergia, index) => (
                          <span
                              key={index}
                              className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                          >
                    {perfilAlergia.alergia?.nombre_alergia}
                  </span>
                      ))}
                    </div>
                  </div>
              )}
            </div>
        )}

        {/* Historial de Servicios Médicos */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">Historial de Servicios Médicos</h3>

          {serviciosMedicos.length > 0 ? (
              <div className="space-y-4">
                {serviciosMedicos.map((servicio) => (
                    <div key={servicio.id_servicio_medico} className="border border-gray-200 rounded-md">
                      <div
                          className="p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleServiceExpansion(servicio.id_servicio_medico)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <Stethoscope className="h-5 w-5 text-blue-600 mr-2" />
                              <h4 className="font-medium text-gray-800">
                                Servicio Médico - {new Date(servicio.fecha_servicio).toLocaleDateString('es-ES')}
                              </h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Hora:</span> {servicio.hora_inicio_servicio} - {servicio.hora_fin_servicio}
                              </div>
                              {servicio.cita_medica?.personal_medico?.persona && (
                                  <div>
                                    <span className="font-medium">Médico:</span> {' '}
                                    {servicio.cita_medica.personal_medico.persona.prenombres} {' '}
                                    {servicio.cita_medica.personal_medico.persona.primer_apellido}
                                  </div>
                              )}
                              {servicio.cita_medica?.personal_medico?.especialidad && (
                                  <div>
                                    <span className="font-medium">Especialidad:</span> {' '}
                                    {servicio.cita_medica.personal_medico.especialidad.descripcion}
                                  </div>
                              )}
                            </div>
                          </div>

                          <div className="ml-4">
                            {expandedServices[servicio.id_servicio_medico] ?
                                <ChevronUp className="h-5 w-5 text-gray-400" /> :
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                            }
                          </div>
                        </div>
                      </div>

                      {expandedServices[servicio.id_servicio_medico] && (
                          <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <div className="space-y-6">

                              {/* Consultas Médicas */}
                              {servicio.consulta_medica && servicio.consulta_medica.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Clipboard className="h-4 w-4 mr-2 text-green-600" />
                                      Consulta Médica
                                    </h5>
                                    {servicio.consulta_medica.map((consulta, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {consulta.motivo_consulta && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Motivo:</span>
                                                <p className="text-sm">{consulta.motivo_consulta}</p>
                                              </div>
                                          )}
                                          {consulta.observaciones_generales && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Observaciones:</span>
                                                <p className="text-sm">{consulta.observaciones_generales}</p>
                                              </div>
                                          )}
                                          {consulta.tipo_servicio && (
                                              <div className="text-xs text-gray-500">
                                                Tipo: {consulta.tipo_servicio.nombre}
                                                {consulta.subtipo_servicio && ` - ${consulta.subtipo_servicio.nombre}`}
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Diagnósticos */}
                              {servicio.diagnostico && servicio.diagnostico.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <FileText className="h-4 w-4 mr-2 text-blue-600" />
                                      Diagnósticos
                                    </h5>
                                    {servicio.diagnostico.map((diagnostico, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {diagnostico.morbilidad && (
                                              <div className="mb-2">
                                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                      {diagnostico.morbilidad.descripcion}
                                    </span>
                                                  {diagnostico.morbilidad.cie10?.codigo && (
                                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        CIE-10: {diagnostico.morbilidad.cie10.codigo}
                                      </span>
                                                  )}
                                                </div>
                                                {diagnostico.morbilidad.cie10?.descripcion && (
                                                    <p className="text-sm text-gray-600 mt-1">
                                                      {diagnostico.morbilidad.cie10.descripcion}
                                                    </p>
                                                )}
                                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                                  <span>Tipo: {diagnostico.morbilidad.tipo}</span>
                                                  {diagnostico.morbilidad.nivel_gravedad && (
                                                      <span>Gravedad: {diagnostico.morbilidad.nivel_gravedad}</span>
                                                  )}
                                                  {diagnostico.morbilidad.contagiosa !== null && (
                                                      <span>
                                        {diagnostico.morbilidad.contagiosa ? 'Contagiosa' : 'No contagiosa'}
                                      </span>
                                                  )}
                                                </div>
                                              </div>
                                          )}

                                          {diagnostico.detalle && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Detalle:</span>
                                                <p className="text-sm">{diagnostico.detalle}</p>
                                              </div>
                                          )}

                                          {/* Síntomas */}
                                          {diagnostico.sintoma && diagnostico.sintoma.length > 0 && (
                                              <div className="mt-2">
                                                <span className="text-sm font-medium">Síntomas:</span>
                                                <div className="mt-1 space-y-1">
                                                  {diagnostico.sintoma.map((sintoma, sIndex) => (
                                                      <div key={sIndex} className="text-sm bg-gray-50 p-2 rounded">
                                                        <div className="flex justify-between items-start">
                                                          <span className="font-medium">{sintoma.nombre_sintoma}</span>
                                                          <span className={`text-xs px-2 py-1 rounded ${
                                                              sintoma.severidad >= 8 ? 'bg-red-100 text-red-800' :
                                                                  sintoma.severidad >= 5 ? 'bg-yellow-100 text-yellow-800' :
                                                                      'bg-green-100 text-green-800'
                                                          }`}>
                                            Severidad: {sintoma.severidad}/10
                                          </span>
                                                        </div>
                                                        {sintoma.descripcion && (
                                                            <p className="text-xs text-gray-600 mt-1">{sintoma.descripcion}</p>
                                                        )}
                                                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                          <span>
                                            Primera manifestación: {new Date(sintoma.fecha_primera_manifestacion).toLocaleDateString('es-ES')}
                                          </span>
                                                          <span>Estado: {sintoma.estado_actual}</span>
                                                        </div>
                                                      </div>
                                                  ))}
                                                </div>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Tratamientos */}
                              {servicio.tratamiento && servicio.tratamiento.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Pill className="h-4 w-4 mr-2 text-purple-600" />
                                      Tratamientos
                                    </h5>
                                    {servicio.tratamiento.map((tratamiento, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {tratamiento.razon && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Razón:</span>
                                                <p className="text-sm">{tratamiento.razon}</p>
                                              </div>
                                          )}

                                          {tratamiento.duracion_cantidad && tratamiento.unidad_tiempo && (
                                              <div className="mb-2 text-sm">
                                                <span className="font-medium">Duración:</span> {' '}
                                                {tratamiento.duracion_cantidad} {tratamiento.unidad_tiempo.nombre}
                                              </div>
                                          )}

                                          {tratamiento.observaciones && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Observaciones:</span>
                                                <p className="text-sm">{tratamiento.observaciones}</p>
                                              </div>
                                          )}

                                          {/* Medicamentos */}
                                          {tratamiento.tratamiento_medicamento && tratamiento.tratamiento_medicamento.length > 0 && (
                                              <div className="mt-2">
                                                <span className="text-sm font-medium">Medicamentos:</span>
                                                <div className="mt-1 space-y-2">
                                                  {tratamiento.tratamiento_medicamento.map((medTratamiento, mIndex) => (
                                                      <div key={mIndex} className="bg-purple-50 p-2 rounded">
                                                        <div className="flex justify-between items-start">
                                                          <div>
                                            <span className="font-medium text-sm">
                                              {medTratamiento.medicamento?.nombre_comercial}
                                            </span>
                                                            {medTratamiento.medicamento?.concentracion && (
                                                                <span className="text-sm text-gray-600 ml-2">
                                                ({medTratamiento.medicamento.concentracion})
                                              </span>
                                                            )}
                                                          </div>
                                                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                            {medTratamiento.medicamento?.laboratorio}
                                          </span>
                                                        </div>

                                                        <div className="mt-1 text-sm">
                                                          <span className="font-medium">Dosis:</span> {medTratamiento.cantidad_dosis}
                                                          <span className="ml-4 font-medium">Frecuencia:</span> {medTratamiento.frecuencia}
                                                        </div>

                                                        {medTratamiento.medicamento?.metodo_administracion && (
                                                            <div className="text-xs text-gray-600 mt-1">
                                                              Administración: {medTratamiento.medicamento.metodo_administracion}
                                                            </div>
                                                        )}

                                                        {medTratamiento.motivo && (
                                                            <div className="text-xs text-gray-600 mt-1">
                                                              Motivo: {medTratamiento.motivo}
                                                            </div>
                                                        )}
                                                      </div>
                                                  ))}
                                                </div>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Exámenes */}
                              {servicio.examen && servicio.examen.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <TestTube className="h-4 w-4 mr-2 text-green-600" />
                                      Exámenes
                                    </h5>
                                    {servicio.examen.map((examen, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          <div className="flex justify-between items-start mb-2">
                                            <div>
                                              {examen.tipo_procedimiento && (
                                                  <span className="font-medium text-sm">{examen.tipo_procedimiento}</span>
                                              )}
                                              {examen.tipo_laboratorio && (
                                                  <span className="text-sm text-gray-600 ml-2">({examen.tipo_laboratorio})</span>
                                              )}
                                            </div>
                                            <span className="text-xs text-gray-500">
                                  {new Date(examen.fecha_hora_atencion).toLocaleString('es-ES')}
                                </span>
                                          </div>

                                          {examen.descripcion_procedimiento && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Procedimiento:</span>
                                                <p className="text-sm">{examen.descripcion_procedimiento}</p>
                                              </div>
                                          )}

                                          {examen.descripcion && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Descripción:</span>
                                                <p className="text-sm">{examen.descripcion}</p>
                                              </div>
                                          )}

                                          {examen.resultado && (
                                              <div className="bg-green-50 p-2 rounded">
                                                <span className="text-sm font-medium">Resultado:</span>
                                                <p className="text-sm">{examen.resultado}</p>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Terapias */}
                              {servicio.terapia && servicio.terapia.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Heart className="h-4 w-4 mr-2 text-pink-600" />
                                      Terapias
                                    </h5>
                                    {servicio.terapia.map((terapia, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {terapia.descripcion && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Descripción:</span>
                                                <p className="text-sm">{terapia.descripcion}</p>
                                              </div>
                                          )}

                                          {terapia.observaciones && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Observaciones:</span>
                                                <p className="text-sm">{terapia.observaciones}</p>
                                              </div>
                                          )}

                                          {terapia.resultados && (
                                              <div className="bg-pink-50 p-2 rounded">
                                                <span className="text-sm font-medium">Resultados:</span>
                                                <p className="text-sm">{terapia.resultados}</p>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Intervenciones Quirúrgicas */}
                              {servicio.intervencion_quirurgica && servicio.intervencion_quirurgica.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Scissors className="h-4 w-4 mr-2 text-red-600" />
                                      Intervenciones Quirúrgicas
                                    </h5>
                                    {servicio.intervencion_quirurgica.map((intervencion, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {intervencion.procedimiento_quirurgico && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Procedimiento:</span>
                                                <p className="text-sm">{intervencion.procedimiento_quirurgico}</p>
                                              </div>
                                          )}

                                          {intervencion.tipo_anestesia && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Tipo de Anestesia:</span>
                                                <p className="text-sm">{intervencion.tipo_anestesia}</p>
                                              </div>
                                          )}

                                          {intervencion.observaciones && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Observaciones:</span>
                                                <p className="text-sm">{intervencion.observaciones}</p>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Controles de Signos Vitales */}
                              {servicio.control && servicio.control.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Activity className="h-4 w-4 mr-2 text-blue-600" />
                                      Controles de Signos Vitales
                                    </h5>
                                    {servicio.control.map((control, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                                            <div className="text-center">
                                              <span className="text-xs text-gray-500">Pulso</span>
                                              <p className="font-medium">{control.pulso_cardiaco} bpm</p>
                                            </div>
                                            <div className="text-center">
                                              <span className="text-xs text-gray-500">Presión</span>
                                              <p className="font-medium">
                                                {control.presion_sistolica}/{control.presion_diastolica} mmHg
                                              </p>
                                            </div>
                                            <div className="text-center">
                                              <span className="text-xs text-gray-500">Oxigenación</span>
                                              <p className="font-medium">{control.oxigenacion}%</p>
                                            </div>
                                            <div className="text-center">
                                              <span className="text-xs text-gray-500">Estado</span>
                                              <p className="font-medium">{control.estado_paciente || 'Normal'}</p>
                                            </div>
                                          </div>

                                          {control.observaciones && (
                                              <div className="mt-2">
                                                <span className="text-sm font-medium">Observaciones:</span>
                                                <p className="text-sm">{control.observaciones}</p>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Ingresos Hospitalarios */}
                              {servicio.ingreso_hospitalizacion && servicio.ingreso_hospitalizacion.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Bed className="h-4 w-4 mr-2 text-orange-600" />
                                      Ingresos Hospitalarios
                                    </h5>
                                    {servicio.ingreso_hospitalizacion.map((ingreso, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {ingreso.razon_ingreso && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Razón de Ingreso:</span>
                                                <p className="text-sm">{ingreso.razon_ingreso}</p>
                                              </div>
                                          )}

                                          {ingreso.atenciones_necesarias && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Atenciones Necesarias:</span>
                                                <p className="text-sm">{ingreso.atenciones_necesarias}</p>
                                              </div>
                                          )}

                                          <div className="flex gap-4 text-sm">
                                            {ingreso.fecha_estimada_alta && (
                                                <div>
                                                  <span className="font-medium">Fecha Estimada de Alta:</span> {' '}
                                                  {new Date(ingreso.fecha_estimada_alta).toLocaleDateString('es-ES')}
                                                </div>
                                            )}
                                            {ingreso.nro_camas && (
                                                <div>
                                                  <span className="font-medium">Número de Cama:</span> {ingreso.nro_camas}
                                                </div>
                                            )}
                                          </div>
                                        </div>
                                    ))}
                                  </div>
                              )}

                              {/* Altas Hospitalarias */}
                              {servicio.alta_hospitalizacion && servicio.alta_hospitalizacion.length > 0 && (
                                  <div>
                                    <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                                      <Bed className="h-4 w-4 mr-2 text-green-600" />
                                      Altas Hospitalarias
                                    </h5>
                                    {servicio.alta_hospitalizacion.map((alta, index) => (
                                        <div key={index} className="bg-white p-3 rounded border">
                                          {alta.motivo_alta && (
                                              <div className="mb-2">
                                                <span className="text-sm font-medium">Motivo de Alta:</span>
                                                <p className="text-sm">{alta.motivo_alta}</p>
                                              </div>
                                          )}

                                          {alta.indicaciones_postalta && (
                                              <div className="bg-green-50 p-2 rounded">
                                                <span className="text-sm font-medium">Indicaciones Post-Alta:</span>
                                                <p className="text-sm">{alta.indicaciones_postalta}</p>
                                              </div>
                                          )}
                                        </div>
                                    ))}
                                  </div>
                              )}

                            </div>
                          </div>
                      )}
                    </div>
                ))}
              </div>
          ) : (
              <div className="text-center py-8 text-gray-500">
                <Stethoscope className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <p>No se encontraron servicios médicos registrados</p>
              </div>
          )}
        </div>
      </div>
  );
};

export default MedicalRecords;