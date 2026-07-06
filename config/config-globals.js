window.DASHBOARD_CONFIGS = {
    "dashboardConfig":  {
                            "project":  {
                                            "title":  "Projeto CTC • O2C Royalties",
                                            "subtitle":  "Status Report Executivo",
                                            "screenTitle":  "Dashboard Executivo CTC • O2C Royalties",
                                            "goLiveDate":  "2027-03-01",
                                            "statusGeneral":  "Atenção",
                                            "statusCaption":  "Em homologação"
                                        },
                            "summary":  {
                                            "projectStatus":  "Em Homologação",
                                            "projectStatusCaption":  "Fase atual do projeto",
                                            "projectProgress":  72,
                                            "testScopeOverride":  null,
                                            "validationProgressOverride":  null
                                        },
                            "validation":  {
                                               "completedStatuses":  [
                                                                         "Concluído",
                                                                         "Concluída",
                                                                         "Validado",
                                                                         "Validada",
                                                                         "Homologado",
                                                                         "Homologada",
                                                                         "Closed",
                                                                         "Done"
                                                                     ],
                                               "prioritizedStatuses":  [
                                                                           "Em Validação",
                                                                           "Em Homologação",
                                                                           "Disponível para Testes",
                                                                           "Disponível para Homologação",
                                                                           "Liberado para Testes",
                                                                           "Em Andamento",
                                                                           "Concluído"
                                                                       ]
                                           },
                            "milestones":  [
                                               {
                                                   "name":  "Sybox + Looker Studio",
                                                   "date":  "2026-07-10",
                                                   "description":  "Alinhamento de evidências e visão executiva"
                                               },
                                               {
                                                   "name":  "Teste de integração DevOps",
                                                   "date":  "2026-07-15",
                                                   "description":  "Validação de integração e atualização de bases"
                                               },
                                               {
                                                   "name":  "Go-live previsto",
                                                   "date":  "2027-03-01",
                                                   "description":  "Marco final do projeto"
                                               }
                                           ],
                            "footer":  {
                                           "showUpdatedAt":  true,
                                           "logos":  [
                                                         "sydle",
                                                         "levty",
                                                         "ctc",
                                                         "integra"
                                                     ]
                                       }
                        },
    "epicosExecutivos":  [
                             {
                                 "id":  "01",
                                 "devopsEpicId":  "310",
                                 "title":  "Licenciar Clientes",
                                 "status":  "Disponível para testes",
                                 "responsible":  "CTC",
                                 "nextAction":  "Definir janela de validação",
                                 "diagram":  "assets/diagrams/epic-01.svg"
                             },
                             {
                                 "id":  "02",
                                 "devopsEpicId":  "312",
                                 "title":  "Gerenciar Regras Comerciais",
                                 "status":  "Disponível para testes",
                                 "responsible":  "CTC",
                                 "nextAction":  "Continuar validações",
                                 "diagram":  "assets/diagrams/epic-02.svg"
                             },
                             {
                                 "id":  "03",
                                 "devopsEpicId":  "313",
                                 "title":  "Capturar Áreas não Licenciadas e Subreportadas",
                                 "status":  "Em refinamento",
                                 "responsible":  "Apsis",
                                 "nextAction":  "Concluir refinamento",
                                 "diagram":  "assets/diagrams/epic-03.svg"
                             },
                             {
                                 "id":  "05",
                                 "devopsEpicId":  "315",
                                 "title":  "Apurar e Receber Royalties",
                                 "status":  "Em homologação",
                                 "responsible":  "Rosangela",
                                 "nextAction":  "Validar 5.1 e 5.2",
                                 "diagram":  "assets/diagrams/epic-05.svg"
                             },
                             {
                                 "id":  "06",
                                 "devopsEpicId":  "311",
                                 "title":  "Assinar Contratos e Termos",
                                 "status":  "Disponível para testes",
                                 "responsible":  "CTC",
                                 "nextAction":  "Executar validação",
                                 "diagram":  "assets/diagrams/epic-06.svg"
                             },
                             {
                                 "id":  "07",
                                 "devopsEpicId":  "316",
                                 "title":  "Controlar Capturas",
                                 "status":  "Backlog",
                                 "responsible":  "A definir",
                                 "nextAction":  "Aguardar priorização",
                                 "diagram":  "assets/diagrams/epic-07.svg"
                             },
                             {
                                 "id":  "08",
                                 "devopsEpicId":  "317",
                                 "title":  "Prever Receita",
                                 "status":  "Backlog",
                                 "responsible":  "A definir",
                                 "nextAction":  "Aguardar priorização",
                                 "diagram":  "assets/diagrams/epic-08.svg"
                             }
                         ],
    "frentesSemana":  [
                          {
                              "title":  "Kickoff / retomada do projeto",
                              "description":  "Realizada reunião presencial de retomada em 18/06 com o CTC. Alinhamento executivo do projeto, esclarecimento de dúvidas e breve apresentação da ferramenta ao Sponsor."
                          },
                          {
                              "title":  "Refinamentos dos épicos 5 e 2",
                              "description":  "Foram conduzidas reuniões de refinamento revisando regras, necessidades de negócio e ajustes para continuidade da homologação."
                          },
                          {
                              "title":  "Refinamento do épico 3",
                              "description":  "Realizada agenda com foco em refinar e validar as regras de negócio do Épico 3."
                          },
                          {
                              "title":  "Novos cards no DevOps",
                              "description":  "Os temas discutidos nas agendas foram registrados em novos cards, evidenciando demandas sugeridas, decisões e próximos ajustes."
                          }
                      ],
    "proximosPassos":  [
                           {
                               "title":  "Continuidade dos refinamentos",
                               "description":  "Manter a cadência de refinamento com CTC e SYDLE.",
                               "responsible":  "Matheus + Rosangela",
                               "dateLabel":  "Até 28/06/2026",
                               "icon":  "checklist"
                           },
                           {
                               "title":  "Visitas presenciais programadas",
                               "description":  "Agendas direcionadas com responsáveis e objetivos por encontro.",
                               "responsible":  "CTC + LEVTY",
                               "dateLabel":  "Período: 30/06 a 04/07",
                               "icon":  "people"
                           },
                           {
                               "title":  "Sybox + Looker Studio",
                               "description":  "Alinhar evidências/documentos e visão executiva.",
                               "responsible":  "LEVTY",
                               "dateLabel":  "Data: 10/07/2026",
                               "icon":  "chart"
                           },
                           {
                               "title":  "Teste de integração DevOps",
                               "description":  "Validar atualização automatizada das bases.",
                               "responsible":  "CTC + Integra+",
                               "dateLabel":  "Data: 15/07/2026",
                               "icon":  "code"
                           }
                       ],
    "statusNormalization":  {
                                "statusOrder":  [
                                                    "Em Produção",
                                                    "Em Homologação",
                                                    "Em Andamento",
                                                    "Bloqueado",
                                                    "Backlog"
                                                ],
                                "statusColors":  {
                                                     "Em Produção":  "#075a57",
                                                     "Em Homologação":  "#159b95",
                                                     "Em Andamento":  "#a9d72d",
                                                     "Bloqueado":  "#f38b2e",
                                                     "Backlog":  "#d8dde3"
                                                 },
                                "mappings":  [
                                                 {
                                                     "normalized":  "Em Produção",
                                                     "match":  [
                                                                   "Done",
                                                                   "Closed",
                                                                   "Concluído",
                                                                   "Concluída",
                                                                   "Homologado",
                                                                   "Homologada",
                                                                   "Em Produção"
                                                               ]
                                                 },
                                                 {
                                                     "normalized":  "Em Homologação",
                                                     "match":  [
                                                                   "Resolved",
                                                                   "Homologação",
                                                                   "Em Homologação",
                                                                   "Em Validação",
                                                                   "Disponível para Testes",
                                                                   "Disponível para Homologação",
                                                                   "Liberado para Testes",
                                                                   "DISPONÍVEL PARA TESTES CTC"
                                                               ]
                                                 },
                                                 {
                                                     "normalized":  "Em Andamento",
                                                     "match":  [
                                                                   "Active",
                                                                   "Doing",
                                                                   "Em Desenvolvimento",
                                                                   "Em Andamento",
                                                                   "Em refinamento",
                                                                   "Refinamento"
                                                               ]
                                                 },
                                                 {
                                                     "normalized":  "Bloqueado",
                                                     "match":  [
                                                                   "Blocked",
                                                                   "Bloqueado",
                                                                   "Impedido"
                                                               ]
                                                 },
                                                 {
                                                     "normalized":  "Backlog",
                                                     "match":  [
                                                                   "New",
                                                                   "To Do",
                                                                   "Backlog",
                                                                   "Removed",
                                                                   "Cancelado",
                                                                   "A definir"
                                                               ]
                                                 }
                                             ]
                            }
};
