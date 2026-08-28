import type { frontRoutes } from "./routes/routes";

type FrontRoutesKeys =
  | keyof typeof frontRoutes
  | "home"
  | "header"
  | "footer"
  | "loginPersona";

type FrontRouteParametrizedKeys =
  | "mode"
  | "internshipKind"
  | "currentStep"
  | "rightName"
  | "apiConsumerId";

type FrontRouteParametrizedValue = (
  params: Partial<Record<FrontRouteParametrizedKeys, string | number>>,
) => string;

type FrontRoutePossibleValues =
  | Record<
      string,
      string | FrontRouteParametrizedValue | Record<string, string>
    >
  | string
  | FrontRouteParametrizedValue;

type FrontRouteValue<V extends FrontRoutePossibleValues> =
  V extends Record<string, string> ? FrontRouteValue<V> : V;

type FrontRoutesValues = Record<
  string,
  string | FrontRouteValue<FrontRoutePossibleValues>
>;

type DomElementIds = Record<FrontRoutesKeys, FrontRoutesValues>;

const buildHeaderNavLinkId = (chunk: string) => `im-header-nav__${chunk}`;
const buildHeroHeaderId = (chunk: string) => `im-hero-header__${chunk}`;
const buildSitemapNavLinkId = (chunk: string) => `im-sitemap-nav__${chunk}`;
const buildFooterNavLinkId = (chunk: string) => `im-footer-nav__${chunk}`;

export const domElementIds = {
  header: {
    navLinks: {
      home: buildHeaderNavLinkId("home"),
      candidate: {
        home: buildHeaderNavLinkId("candidate-home"),
        search: buildHeaderNavLinkId("candidate-search"),
        formConvention: buildHeaderNavLinkId("candidate-form-convention"),
        dashboard: buildHeaderNavLinkId("candidate-dashboard"),
      },
      establishment: {
        home: buildHeaderNavLinkId("establishment-home"),
        addEstablishmentForm: buildHeaderNavLinkId("establishment-form"),
        formConvention: buildHeaderNavLinkId("establishment-form-convention"),
        dashboard: buildHeaderNavLinkId("establishment-dashboard"),
      },
      agency: {
        home: buildHeaderNavLinkId("agency-home"),
        agencyDashboardAgencies: buildHeaderNavLinkId(
          "agency-dashboard-agencies",
        ),
        formConvention: buildHeaderNavLinkId("agency-form-convention"),
        dashboard: buildHeaderNavLinkId("agency-my-dashboard"),
        resourcesAndWebinars: buildHeaderNavLinkId(
          "agency-resources-and-webinars",
        ),
      },
      admin: {
        backOffice: buildHeaderNavLinkId("admin-home"),
        emails: buildHeaderNavLinkId("admin-emails"),
      },
      quickAccess: {
        beneficiary: buildHeaderNavLinkId("quick-access-beneficiary"),
        establishment: buildHeaderNavLinkId("quick-access-establishment"),
        agency: buildHeaderNavLinkId("quick-access-agency"),
        myAccount: buildHeaderNavLinkId("quick-access-my-account"),
        initiateConvention: buildHeaderNavLinkId(
          "quick-access-initiate-convention",
        ),
      },
    },
  },

  footer: {
    overFooterCols: {
      faq: buildFooterNavLinkId("over-faq"),
      linkedin: buildFooterNavLinkId("over-linkedin"),
      contact: buildFooterNavLinkId("over-contact"),
    },
    navTopGroupLinks: {
      search: buildFooterNavLinkId("footer-nav-top-candidate-search"),
      formConvention: buildFooterNavLinkId("footer-nav-top-form-convention"),
      addEstablishmentForm: buildFooterNavLinkId(
        "footer-nav-top-establishement-form-convention",
      ),
      establishementformConvention: buildFooterNavLinkId(
        "footer-nav-top-establishement-form-convention",
      ),
      addAgencyForm: buildFooterNavLinkId("footer-nav-top-agency-form"),
      agencyformConvention: buildFooterNavLinkId(
        "footer-nav-top-agency-form-convention",
      ),
      archivedConventionRequest: buildFooterNavLinkId(
        "footer-nav-top-archived-convention-request",
      ),
      linkedin: buildFooterNavLinkId("footer-nav-top-linkedin"),
    },
    links: {
      gouv: buildFooterNavLinkId("gouv"),
      civilService: buildFooterNavLinkId("service-public"),
      inclusion: buildFooterNavLinkId("plateforme-inclusion"),
    },
    bottomLinks: {
      accessibility: buildFooterNavLinkId("accessibility"),
      legals: buildFooterNavLinkId("legals"),
      privacy: buildFooterNavLinkId("privacy"),
      cgu: buildFooterNavLinkId("cgu"),
      contact: buildFooterNavLinkId("contact"),
      stats: buildFooterNavLinkId("stats"),
      sitemap: buildFooterNavLinkId("sitemap"),
      budget: buildFooterNavLinkId("budget"),
      apiDocumentation: buildFooterNavLinkId("api-documentation"),
      resourcesAndWebinars: buildFooterNavLinkId("resources-and-webinars"),
    },
  },

  loginPersona: {
    radioButtons: "im-login-form__persona-radio-buttons",
  },

  home: {
    heroHeader: {
      candidate: buildHeroHeaderId("home-candidate"),
      establishment: buildHeroHeaderId("home-establishment"),
      agency: buildHeroHeaderId("home-agency"),
      resourcesAndWebinars: buildHeroHeaderId("home-resources-and-webinars"),
    },
  },

  homeEstablishments: {
    heroHeader: {
      addEstablishmentForm: buildHeroHeaderId("establishment-form-register"),
      formConvention: buildHeroHeaderId("establishment-form-convention"),
      establishmentDashboard: buildHeroHeaderId("establishment-dashboard"),
    },
  },
  homeAgencies: {
    heroHeader: {
      addAgencyForm: buildHeroHeaderId("agency-form-register"),
      formConvention: buildHeroHeaderId("agency-form-convention"),
      agencyDashboard: buildHeroHeaderId("agency-dashboard"),
    },
  },
  homeCandidates: {
    heroHeader: {
      search: buildHeroHeaderId("candidate-search"),
      formConvention: buildHeroHeaderId("candidate-form-convention"),
      dashboard: buildHeroHeaderId("candidate-dashboard"),
    },
  },

  search: {
    openMapButton: "im-search-page__open-map-button",
    filterAppellationSection: "im-search-page__filter-appellation-section",
    filterLocationSection: "im-search-page__filter-location-section",
    filterConditionsSection: "im-search-page__filter-conditions-section",
    appellationAutocomplete: "im-search-page__appellation-autocomplete",
    appellationFilterTag: "im-search-page__appellation-filter-tag",
    distanceSelect: "im-search-page__distance-dropdown",
    fitForDisableWorkersFilterTag:
      "im-search-page__fit-for-disabled-workers-filter-tag",
    lbbSearchResultButton: "im-search-result__lbb-contact-button",
    locationFilterTag: "im-search-page__location-filter-tag",
    nafAutocomplete: "im-search-page__naf-autocomplete",
    noResultsLbbButton: "im-search-page__no-results-lbb-button",
    noResultsAvailabilityButton:
      "im-search-page__no-results-availability-button",
    noResultsLbbCard: "im-search-page__no-results-lbb-card",
    placeAutocompleteInput: "im-search-page__address-autocomplete",
    resultPerPageDropdown: "im-search-page__results-per-page-dropdown",
    searchForm: "im-search-page__search-form",
    searchResultButton: "im-search-result__contact-button",
    searchSortOptionBase: "im-search__search-sort-option-",
    searchSubmitButton: "im-search__submit-search",
    sortFilter: "im-search-page__sort-filter-select",
    sortFilterTag: "im-search-page__sort-filter-tag",
    sortRadioButtons: "im-search-page__sort-radio-buttons",
    resetFiltersButton: "im-search-page__reset-filters-button",
  },
  externalSearch: {
    // TODO: add external search specific ids
    appellationAutocomplete: "im-search-page__appellation-autocomplete",
    appellationFilterTag: "im-search-page__appellation-filter-tag",
    distanceSelect: "im-search-page__distance-dropdown",
    fitForDisableWorkersFilterTag:
      "im-search-page__fit-for-disabled-workers-filter-tag",
    lbbSearchResultButton: "im-search-result__lbb-contact-button",
    locationFilterTag: "im-search-page__location-filter-tag",
    nafAutocomplete: "im-search-page__naf-autocomplete",
    placeAutocompleteInput: "im-search-page__address-autocomplete",
    resultPerPageDropdown: "im-search-page__results-per-page-dropdown",
    searchForm: "im-search-page__search-form",
    searchResultButton: "im-search-result__contact-button",
    searchSortOptionBase: "im-search__search-sort-option-",
    searchSubmitButton: "im-search__submit-search",
    sortFilter: "im-search-page__sort-filter-select",
    sortFilterTag: "im-search-page__sort-filter-tag",
    sortRadioButtons: "im-search-page__sort-radio-buttons",
    resetFiltersButton: "im-search-page__reset-filters-button",
    filterLocationSection: "im-search-page__filter-location-section",
    filterConditionsSection: "im-search-page__filter-conditions-section",
  },
  searchForStudent: {
    appellationAutocomplete:
      "im-search-page__appellation-autocomplete--students",
    appellationFilterTag: "im-search-page__appellation-filter-tag--students",
    distanceSelect: "im-search-page__distance-dropdown",
    fitForDisableWorkersFilterTag:
      "im-search-page__fit-for-disabled-workers-filter-tag--students",
    lbbSearchResultButton: "im-search-result__lbb-contact-button--student",
    locationFilterTag: "im-search-page__location-filter-tag--students",
    nafAutocomplete: "im-search-page__naf-autocomplete--students",
    placeAutocompleteInput: "im-search-page__address-autocomplete--students",
    searchForm: "im-search-page__search-form--student",
    searchResultButton: "im-search-result__contact-button--student",
    searchSubmitButton: "im-search__submit-search-for-students",
    sortFilterTag: "im-search-page__sort-filter-tag--students",
    sortRadioButtons: "im-search-page__sort-radio-buttons--students",
    resetFiltersButton: "im-search-page__reset-filters-button--students",
    filterLocationSection: "im-search-page__filter-location-section--students",
    filterConditionsSection:
      "im-search-page__filter-conditions-section--students",
  },
  searchResult: {
    contactByMailButton: "im-contact-establishment__contact-email-button",
    contactByMailForm: "im-contact-form--email",
    contactByPhoneButton: "im-contact-establishment__contact-phone-button",
    contactByPhoneForm: "im-contact-form--phone",
    contactInPersonButton: "im-contact-establishment__contact-in-person-button",
    contactInPersonForm: "im-contact-form--in-person",
  },
  searchResultForStudent: {
    contactByMailButton:
      "im-contact-establishment__contact-email-button--student",
    contactByMailForm: "im-contact-form--email-student",
    contactByPhoneButton:
      "im-contact-establishment__contact-phone-button--student",
    contactByPhoneForm: "im-contact-form--phone-student",
    contactInPersonButton:
      "im-contact-establishment__contact-in-person-button--student",
    contactInPersonForm: "im-contact-form--in-person-student",
  },
  searchResultExternal: {
    contactByMailButton:
      "im-contact-establishment__contact-email-button--external",
  },
  addAgency: {
    login: {
      byEmailButton: "im-login-form__connect-button--agency-email",
      proConnectButton: "im-login-form__inclusion-connect-button--agency",
      navigateToHome: "im-login-form__navigate-to-home-button--agency",
      retryButton: "im-login-form__retry-login-button--agency",
      contactSupport: "im-login-form__contact-support-link--agency",
    },
    form: "im-form-add-agency",
    uploadLogoInput: "im-form-add-agency__file-upload-logo",
    id: "im-form-add-agency__id",
    coveredDepartmentsInput: "im-form-add-agency__covered-departments",
    nameInput: "im-form-add-agency__name",
    agencyContactEmailInput: "im-form-add-agency__contact-email",
    addressInput: {
      address: "im-form-add-agency__address",
      city: "im-form-add-agency__address-city",
      departmentCode: "im-form-add-agency__address-departement-code",
      postcode: "im-form-add-agency__address-postcode",
      streetNumberAndAddress:
        "im-form-add-agency__address-street-number-and-address",
    },
    positionInput: "im-form-add-agency__position",
    logoUrlInput: "im-form-add-agency__logo-url",
    validatorEmailsInput: "im-form-add-agency__validator-emails",
    adminEmailsInput: "im-form-add-agency__admin-emails",
    signatureInput: "im-form-add-agency__signature",
    statusInput: "im-form-add-agency__status",
    kindSelect: "im-form-add-agency__kind",
    counsellorEmailsInput: "im-form-add-agency__counsellor-emails",
    codeSafirInput: "im-form-add-agency__code-safir",
    agencySiretInput: "im-form-add-agency__agency-siret",
    agencyRefersToInput:
      "im-form-add-agency__im-form-add-agency__refers-to-agency-input",
    stepsForValidationInput: "im-form-add-agency__steps-for-validation",
    submitButton: "im-form-add-agency__submit-button",
    refersToAgencyId: "im-form-add-agency__refers-to-agency-id",
    phoneNumberInput: "im-form-add-agency__phone-number",
    addressAutocomplete: "im-form-add-agency__address-autocomplete-input",
  },

  conventionImmersion: {
    form: (params) =>
      `im-convention-${params.internshipKind}-form--${params.mode}`,
    fromSharedConventionContinueButton:
      "im-convention-form__from-shared-convention-continue-button",
    copyLinkButton: "im-convention-form__copy-link-button",
    showFormButton: "im-convention-form__show-form-button",
    submitFormButton: "im-convention-form__submit-form-button",
    submitFormButtonMobile: "im-convention-form__submit-form-button--mobile",
    confirmSubmitFormButton: "im-convention-form__confirm-submit-form-button",
    summaryEditButton: "im-convention-form__summary-edit-button",
    statusJustificationInput: "im-convention-form__status-justification-input",
    conventionSection: {
      agencyDepartment: "im-convention-form__agencyDepartement",
      agencyId: "im-convention-form__agencyId",
      agencyKind: "im-convention-form__agencyKind",
      agencyReferentFirstName: "im-convention-form__agencyReferentFirstName",
      agencyReferentLastName: "im-convention-form__agencyReferentLastName",
      dateStart: "im-convention-form__dateStart",
      dateEnd: "im-convention-form__dateEnd",
      addHoursButton: "im-convention-form__add-hours-button",
      siret: "im-convention-form__siret",
      businessName: "im-convention-form__businessName",
      businessNameCustomized: "im-convention-form__businessNameCustomized",
      workConditions: "im-convention-form__workConditions",
      individualProtection: "im-convention-form__individualProtection",
      individualProtectionDescription:
        "im-convention-form__workConditionsDescription",
      sanitaryPrevention: "im-convention-form__sanitaryPrevention",
      sanitaryPreventionDescription:
        "im-convention-form__sanitaryPreventionDescription",
      remoteWorkMode: "im-convention-form__remoteWorkMode",
      immersionAddress: "im-convention-form__immersionAddress",
      immersionObjective: "im-convention-form__immersionObjective",
      immersionAppellation: "im-convention-form__immersionAppellation",
      immersionActivities: "im-convention-form__immersionActivities",
      immersionSkills: "im-convention-form__immersionSkills",
      isCurrentEmployer: "im-convention-form__isCurrentEmployer",
      isEstablishmentTutorIsEstablishmentRepresentative:
        "im-convention-form__isEstablishmentTutorIsEstablishmentRepresentative",
      businessAdvantages: "im-convention-form__businessAdvantages",
      isMinor: "im-convention-form__isMinor",
    },
    beneficiarySection: {
      firstName: "im-convention-form__signatories-beneficiary-firstName",
      lastName: "im-convention-form__signatories-beneficiary-lastName",
      birthdate: "im-convention-form__signatories-beneficiary-birthdate",
      email: "im-convention-form__signatories-beneficiary-email",
      phone: "im-convention-form__signatories-beneficiary-phone",
      levelOfEducation:
        "im-convention-form__signatories-beneficiary-level-of-education",
      schoolName: "im-convention-form__signatories-beneficiary-school-name",
      schoolPostcode:
        "im-convention-form__signatories-beneficiary-school-postcode",
      financiaryHelp:
        "im-convention-form__signatories-beneficiary-financiary-help",
      federatedIdentity:
        "im-convention-form__signatories-beneficiary-federatedIdentity",
      emergencyContact:
        "im-convention-form__signatories-beneficiary-emergencyContact",
      emergencyContactPhone:
        "im-convention-form__signatories-beneficiary-emergencyContactPhone",
      emergencyContactEmail:
        "im-convention-form__signatories-beneficiary-emergencyContactEmail",
      isRqth: "im-convention-form__signatories-beneficiary-isRqth",
      address: "im-convention-form__signatories-beneficiary-address",
    },
    establishmentTutorSection: {
      firstName: "im-convention-form__establishmentTutor-firstName",
      lastName: "im-convention-form__establishmentTutor-lastName",
      email: "im-convention-form__establishmentTutor-email",
      phone: "im-convention-form__establishmentTutor-phone",
      job: "im-convention-form__establishmentTutor-job",
    },
    beneficiaryRepresentativeSection: {
      firstName:
        "im-convention-form__signatories-beneficiaryRepresentative-firstName",
      lastName:
        "im-convention-form__signatories-beneficiaryRepresentative-lastName",
      email: "im-convention-form__signatories-beneficiaryRepresentative-email",
      phone: "im-convention-form__signatories-beneficiaryRepresentative-phone",
    },
    beneficiaryCurrentEmployerSection: {
      businessName:
        "im-convention-form__signatories-beneficiaryCurrentEmployer-businessName",
      job: "im-convention-form__signatories-beneficiaryCurrentEmployer-job",
      email: "im-convention-form__signatories-beneficiaryCurrentEmployer-email",
      phone: "im-convention-form__signatories-beneficiaryCurrentEmployer-phone",
      firstName:
        "im-convention-form__signatories-beneficiaryCurrentEmployer-firstName",
      lastName:
        "im-convention-form__signatories-beneficiaryCurrentEmployer-lastName",
      businessSiret:
        "im-convention-form__signatories-beneficiaryCurrentEmployer-businessSiret",
      businessAddress:
        "im-convention-form__signatories-beneficiaryCurrentEmployer-businessAddress",
    },
    establishmentRepresentativeSection: {
      firstName:
        "im-convention-form__signatories-establishmentRepresentative-firstName",
      lastName:
        "im-convention-form__signatories-establishmentRepresentative-lastName",
      email:
        "im-convention-form__signatories-establishmentRepresentative-email",
      phone:
        "im-convention-form__signatories-establishmentRepresentative-phone",
    },
    shareConventionDraft: {
      shareButton: "im-convention-form__share-button",
      shareForm: "im-convention-form__share-form",
      shareFormEmailInput: "im-convention-form__share-form-email-input",
      shareFormRecipientEmailInput:
        "im-convention-form__share-form-recipient-email-input",
      shareFormDetailsInput: "im-convention-form__share-form-details-input",
      shareFormCancelButton: "im-convention-form__share-form-cancel-button",
      shareFormSubmitButton: "im-convention-form__share-form-submit-button",
    },
    deleteHoursButton: "im-convention-form__delete-hours-button",
    conventionConfirmation: {
      copyConventionIdButton:
        "im-convention-confirmation__copy-convention-id-button",
    },
  },

  manageConvention: {
    otherActionsButton: "im-manage-convention__other-actions-button",
    mobileManageConventionButton:
      "im-manage-convention__mobile-manage-convention-button",
    cancelActionButton: "im-manage-convention__cancel-action-button",
    editActionsButton: "im-manage-convention__edit-actions-button",
    editLink: "im-manage-convention__edit-link",
    transferToAgencyModal: "im-manage-convention__transfer-agency-modal",
    transferToAgencyButton:
      "im-manage-convention__open-transfer-to-agency-modal-button",
    transferToAgencyCancelButton:
      "im-manage-convention__transfer-to-agency-cancel-button",
    transferToAgencySubmitButton:
      "im-manage-convention__transfer-to-agency-submit-button",
    abandonAssessmentButton: "im-manage-convention__abandon-assessment-button",
    assessmentActionsButton: "im-manage-convention__assessment-actions-button",
    assessmentDocumentButton:
      "im-manage-convention__assessment-document-button",
    deleteAssessmentButton: "im-manage-convention__delete-assessment-button",
    assessmentFullFillButton:
      "im-manage-convention__assessment-full-fill-button",

    conventionValidationRejectButton: "im-convention-validation__reject-button",
    conventionValidationValidateButton:
      "im-convention-validation__validate-button",
    conventionValidationCancelButton: "im-convention-validation__cancel-button",
    conventionValidationCancelActionButtons:
      "im-convention-validation__cancel--actions-buttons",
    conventionValidationDeprecateButton:
      "im-convention-validation__deprecate-button",
    duplicateConventionButton: "im-convention-validation__duplicate-button",
    editCounsellorNameButton:
      "im-convention-validation__edit-counsellor-name-button",
    editCounsellorNameModal: "im-edit-counsellor-name-modal",
    editCounsellorNameModalForm: "im-edit-counsellor-name-modal__form",
    editCounsellorNameModalSubmitButton:
      "im-edit-counsellor-name-modal__submit-button",
    editCounsellorNameModalCancelButton:
      "im-edit-counsellor-name-modal__cancel-button",
    editConventionWithFinalStatusButton:
      "im-convention-validation__edit-convention-with-final-status-button",
    editConventionWithFinalStatusModal:
      "im-edit-convention-with-final-status-modal",
    editConventionWithFinalStatusModalForm:
      "im-edit-convention-with-final-status-modal__form",
    editConventionWithFinalStatusModalNewDateInput:
      "im-edit-convention-with-final-status-modal__new-date-input",
    editConventionWithFinalStatusModalNewFirstNameInput:
      "im-edit-convention-with-final-status-modal__new-first-name-input",
    editConventionWithFinalStatusModalNewLastNameInput:
      "im-edit-convention-with-final-status-modal__new-last-name-input",
    editConventionWithFinalStatusModalTutorFirstNameInput:
      "im-edit-convention-with-final-status-modal__tutor-first-name-input",
    editConventionWithFinalStatusModalTutorLastNameInput:
      "im-edit-convention-with-final-status-modal__tutor-last-name-input",
    editConventionWithFinalStatusModalTutorJobInput:
      "im-edit-convention-with-final-status-modal__tutor-job-input",
    editConventionWithFinalStatusModalTutorEmailInput:
      "im-edit-convention-with-final-status-modal__tutor-email-input",
    editConventionWithFinalStatusModalTutorPhoneInput:
      "im-edit-convention-with-final-status-modal__tutor-phone-input",
    editConventionWithFinalStatusModalSubmitButton:
      "im-edit-convention-with-final-status-modal__submit-button",
    editConventionWithFinalStatusModalCancelButton:
      "im-edit-convention-with-final-status-modal__cancel-button",
    rejectedModalCancelButton: "im-rejected-modal__cancel-button",
    cancelModalCancelButton: "im-cancel-modal__cancel-button",
    deprecatedModalCancelButton: "im-deprecated-modal__cancel-button",
    rejectedModalSubmitButton: "im-rejected-modal__submit-button",
    cancelModalSubmitButton: "im-cancel-modal__submit-button",
    deprecatedModalSubmitButton: "im-deprecated-modal__submit-button",
    validatorModalCancelButton: "im-validator-modal__cancel-button",
    validatorModalSubmitButton: "im-validator-modal__submit-button",
    validatorModalSyncErrorWarningConfirmButton:
      "im-validator-modal__sync-error-warning-confirm-button",
    validatorModalSyncErrorWarningCloseButton:
      "im-validator-modal__sync-error-warning-close-button",
    validatorModalForm: "im-validator-modal__form",
    counsellorModal: "im-counsellor-modal",
    counsellorModalForm: "im-counsellor-modal__form",
    counsellorModalSubmitButton: "im-counsellor-modal__submit-button",
    counsellorModalCancelButton: "im-counsellor-modal__cancel-button",
    rejectedModal: "im-rejected-modal",
    rejectedModalForm: "im-rejected-modal__form",
    deprecatedModal: "im-deprecate-modal",
    deprecateModalForm: "im-deprecate-modal__form",
    validatorModal: "im-validator-modal",
    cancelModal: "im-cancel-modal",
    cancelModalForm: "im-cancel-modal__form",
    deleteAssessmentModal: "im-delete-assessment-modal",
    deleteAssessmentModalForm: "im-delete-assessment-modal__form",
    deleteAssessmentModalSubmitButton:
      "im-delete-assessment-modal__submit-button",
    deleteAssessmentModalCancelButton:
      "im-delete-assessment-modal__cancel-button",
    renewModal: "im-renew-modal",
    renewModalForm: "im-renew-modal__form",
    fillAssessmentInfoModal: "im-fill-assessment-info-modal",
    openSendSignatureLinkModal:
      "im-convention-validation__open-send-signature-link-modal",
    sendSignatureLinkModal:
      "im-convention-validation__send-signature-link-modal",
    sendSignatureLinkModalForm:
      "im-convention-validation__send-signature-link-modal-form",
    submitSendSignatureLinkModalButton:
      "im-convention-validation__send-signature-link-modal-button",
    sendSignatureLinkModalReminderKindOptions:
      "im-convention-validation__send-signature-link-modal-reminder-kind-options",
    openSignModalButton: "im-convention-validation__open-sign-modal-button",
    sendAssessmentLinkModal:
      "im-convention-validation__send-assessment-link-modal",
    openSendAssessmentLinkModal:
      "im-convention-validation__open-send-assessment-link-modal",
    sendAssessmentLinkModalReminderKindOptions:
      "im-convention-validation__send-assessment-link-modal-reminder-kind-options",
    openSendAssessmentSignatureReminderModal:
      "im-convention-validation__open-send-assessment-signature-reminder-modal",
    sendAssessmentSignatureReminderModal:
      "im-convention-validation__send-assessment-signature-reminder-modal",
    sendAssessmentSignatureReminderModalForm:
      "im-convention-validation__send-assessment-signature-reminder-modal-form",
    submitSendAssessmentSignatureReminderModalButton:
      "im-convention-validation__send-assessment-signature-reminder-modal-button",
    sendAssessmentSignatureReminderModalReminderKindOptions:
      "im-convention-validation__send-assessment-signature-reminder-modal-reminder-kind-options",
    signModal: "im-convention-validation__sign-modal",
    signModalForm: "im-convention-validation__sign-modal-form",
    submitSignModalButton: "im-convention-validation__submit-sign-modal-button",
    submitRenewModalButton:
      "im-convention-validation__submit-renew-modal-button",
    renewModalCancelButton:
      "im-convention-validation__renew-modal-cancel-button",
    openRenewModalButton: "im-convention-validation__open-renew-modal-button",
    openDocumentButton: "im-convention-validation__open-document-button",
    transferConventionModal:
      "im-convention-validation__open-transfer-agency-button",
    transferConventionModalForm:
      "im-convention-validation__transfer-agency-modal-form",
    validatorModalLastNameInput: "im-validator-modal__last-name-input",
    validatorModalFirstNameInput: "im-validator-modal__first-name-input",
    editCounsellorNameModalLastNameInput:
      "im-edit-counsellor-name-modal__last-name-input",
    editCounsellorNameModalFirstNameInput:
      "im-edit-counsellor-name-modal__first-name-input",
    openMarkConventionAsHandledModal:
      "im-open-mark-convention-as-handled-modal",
    openBroadcastConventionAgainModal:
      "im-open-broadcast-convention-again-modal",
    markConventionAsHandledButton: "im-mark-convention-as-handled-button",
    broadcastConventionAgainButton: "im-broadcast-convention-again-button",
    erroredConventionHandledModal: "im-errored-convention-handled-modal",
    broadcastAgainModal: "im-broadcast-modal",
    broadcastAgainModalForm: "im-broadcast-modal__form",
  },

  unregisterEstablishmentLead: {},

  formEstablishment: {
    offerModal: "im-offer-modal",
    offerModalSubmitButton: "im-offer-modal__submit-button",
    login: {
      byEmailButton: "im-login-form__connect-button--establishment-email",
      proConnectButton:
        "im-login-form__inclusion-connect-button--establishment",
      navigateToHome: "im-login-form__navigate-to-home-button--establishment",
      retryButton: "im-login-form__retry-login-button--establishment",
      contactSupport: "im-login-form__contact-support-link--establishment",
    },
    create: {
      form: "im-form-create-establishment",
      addOfferButton: "im-form-create-establishment__add-offer-button",
      editOfferButton: "im-form-create-establishment__edit-offer-button",
      deleteOfferButton: "im-form-create-establishment__delete-offer-button",
      addressAutocomplete:
        "im-form-create-establishment__autocomplete-address-creation-establishment-form",
      siret: "im-form-create-establishment__siret",
      businessName: "im-form-create-establishment__business-name",
      businessNameCustomized:
        "im-form-create-establishment__business-name-customized",
      businessAddresses: "im-form-create-establishment__business-addresses",
      potentialBeneficiaryWelcomeAddress:
        "im-form-create-establishment__potential-beneficiary-welcome-address",
      businessContact: {
        lastName: "im-form-create-establishment__business-contact-last-name",
        firstName: "im-form-create-establishment__business-contact-first-name",
        job: "im-form-create-establishment__businessContact-job",
        phone: "im-form-create-establishment__businessContact-phone",
        email: "im-form-create-establishment__businessContact-email",
        copyEmails: "im-form-create-establishment__businessContact-copy-emails",
        shouldReceiveDiscussionNotifications:
          "im-form-create-establishment__businessContact-should-receive-discussion-notifications",
        isMainContactByPhone:
          "im-form-create-establishment__businessContact-is-main-contact-by-phone",
        isMainContactInPerson:
          "im-form-create-establishment__businessContact-is-main-contact-in-person",
      },
      contactMode:
        "im-form-create-establishment__businessContact-contact-method",
      isEngagedEnterprise:
        "im-form-create-establishment__is-engaged-enterprise",
      fitForDisabledWorkers:
        "im-form-create-establishment__fit-for-disabled-workers",
      appellations: "im-form-create-establishment__appellations",
      remoteWorkMode: "im-form-create-establishment__remote-work-mode",
      website: "im-form-create-establishment__website",
      additionalInformation:
        "im-form-create-establishment__additional-information",
      maxContactsPerMonth:
        "im-form-create-establishment__max-contacts-per-month",
      maxContactsPerMonthWhenAvailable:
        "im-form-create-establishment__max-contacts-per-month-when-available",
      errorSiretAlreadyExistButton:
        "im-form-create-establishment__edit-establishment-button",
      startFormButton: "im-form-create-establishment__start-button",
      submitFormButton: "im-form-create-establishment__submit-button",
      availabilityButton: "im-form-create-establishment__availability-button",
      nextAvailabilityDateInput:
        "im-form-create-establishment__next-availability-date",
      navigateToEstablishmentDashboard:
        "im-form-create-establishment__navigate-establishment-dahsboard-button",
      previousButtonFromStepAndMode: ({ currentStep }) =>
        `im-form-create-establishment__previous-button--step-${currentStep}`,
      nextButtonFromStepAndMode: ({ currentStep }) =>
        `im-form-create-establishment__next-button--step-${currentStep}`,
      searchableBy: "im-form-create-establishment__searchable-by",
      summarySiretValue: "im-form-create-establishment__summary-siret-value",
      summaryAdminName: "im-form-create-establishment__summary-admin-name",
      summaryBusinessAddresses:
        "im-form-create-establishment__summary-business-addresses",
      summaryAppellations: "im-form-create-establishment__summary-appellations",
      offerCard: "im-form-create-establishment__offer-card",
    },
    edit: {
      form: "im-form-edit-establishment",
      addOfferButton: "im-form-edit-establishment__add-offer-button",
      editOfferButton: "im-form-edit-establishment__edit-offer-button",
      deleteOfferButton: "im-form-edit-establishment__delete-offer-button",
      addressAutocomplete:
        "im-form-edit-establishment__autocomplete-address-creation-establishment-form",
      siret: "im-form-edit-establishment__siret",
      businessName: "im-form-edit-establishment__business-name",
      businessNameCustomized:
        "im-form-edit-establishment__business-name-customized",
      businessAddresses: "im-form-edit-establishment__business-addresses",
      potentialBeneficiaryWelcomeAddress:
        "im-form-edit-establishment__potential-beneficiary-welcome-address",
      businessContact: {
        lastName: "im-form-edit-establishment__business-contact-last-name",
        firstName: "im-form-edit-establishment__business-contact-first-name",
        job: "im-form-edit-establishment__businessContact-job",
        phone: "im-form-edit-establishment__businessContact-phone",
        email: "im-form-edit-establishment__businessContact-email",
        copyEmails: "im-form-edit-establishment__businessContact-copy-emails",
        shouldReceiveDiscussionNotifications:
          "im-form-edit-establishment__businessContact-should-receive-discussion-notifications",
        isMainContactByPhone:
          "im-form-edit-establishment__businessContact-is-main-contact-by-phone",
        isMainContactInPerson:
          "im-form-edit-establishment__businessContact-is-main-contact-in-person",
      },
      contactMode: "im-form-edit-establishment__businessContact-contact-method",
      isEngagedEnterprise: "im-form-edit-establishment__is-engaged-enterprise",
      fitForDisabledWorkers:
        "im-form-edit-establishment__fit-for-disabled-workers",
      appellations: "im-form-edit-establishment__appellations",
      remoteWorkMode: "im-form-edit-establishment__remote-work-mode",
      website: "im-form-edit-establishment__website",
      additionalInformation:
        "im-form-edit-establishment__additional-information",
      maxContactsPerMonth: "im-form-edit-establishment__max-contacts-per-month",
      maxContactsPerMonthWhenAvailable:
        "im-form-edit-establishment__max-contacts-per-month-when-available",
      addAppellationButton:
        "im-form-edit-establishment__add-appellation-button",
      addAddressButton: "im-form-edit-establishment__add-address-button",
      errorSiretAlreadyExistButton:
        "im-form-edit-establishment__edit-establishment-button",
      startFormButton: "im-form-edit-establishment__start-button",
      submitFormButton: "im-form-edit-establishment__submit-button",
      availabilityButton: "im-form-edit-establishment__availability-button",
      nextAvailabilityDateInput:
        "im-form-edit-establishment__next-availability-date",
      previousButtonFromStepAndMode: ({ currentStep }) =>
        `im-form-edit-establishment__previous-button--step-${currentStep}`,
      nextButtonFromStepAndMode: ({ currentStep }) =>
        `im-form-edit-establishment__next-button--step-${currentStep}`,
      searchableBy: "im-form-edit-establishment__searchable-by",
      refreshEditLink: "im-form-edit-establishment__refresh-link",
      offerCard: "im-form-edit-establishment__offer-card",
      userRightsList: "im-form-edit-establishment__users-list",
    },
    admin: {
      form: "im-form-manage-establishment-admin",
      addOfferButton: "im-form-manage-establishment-admin__add-offer-button",
      editOfferButton: "im-form-manage-establishment-admin__edit-offer-button",
      deleteOfferButton:
        "im-form-manage-establishment-admin__delete-offer-button",
      manageButton: "im-form-manage-establishment-admin__manage-button",
      searchableBy: "im-form-manage-establishment-admin__searchable-by",
      startFormButton: "im-form-manage-establishment-admin__start-button",
      submitFormButton: "im-form-manage-establishment-admin__submit-button",
      addAppellationButton:
        "im-form-manage-establishment-admin__add-appellation-button",
      businessAddresses:
        "im-form-manage-establishment-admin__business-addresses",
      previousButtonFromStepAndMode: ({ currentStep }) =>
        `im-form-manage-establishment-admin__previous-button--step-${currentStep}`,
      nextButtonFromStepAndMode: ({ currentStep }) =>
        `im-form-manage-establishment-admin__next-button--step-${currentStep}`,
      addressAutocomplete:
        "im-form-manage-establishment-admin__autocomplete-address-creation-establishment-form",
      siret: "im-form-manage-establishment-admin__siret",
      businessName: "im-form-manage-establishment-admin__business-name",
      businessNameCustomized:
        "im-form-manage-establishment-admin__business-name-customized",
      potentialBeneficiaryWelcomeAddress:
        "im-form-manage-establishment-admin__potential-beneficiary-welcome-address",
      businessContact: {
        lastName:
          "im-form-manage-establishment-admin__business-contact-last-name",
        firstName:
          "im-form-manage-establishment-admin__business-contact-first-name",
        job: "im-form-manage-establishment-admin__businessContact-job",
        phone: "im-form-manage-establishment-admin__businessContact-phone",
        email: "im-form-manage-establishment-admin__businessContact-email",
        copyEmails:
          "im-form-manage-establishment-admin__businessContact-copy-emails",
        shouldReceiveDiscussionNotifications:
          "im-form-manage-establishment-admin__businessContact-should-receive-discussion-notifications",
        isMainContactByPhone:
          "im-form-manage-establishment-admin__businessContact-is-main-contact-by-phone",
        isMainContactInPerson:
          "im-form-manage-establishment-admin__businessContact-is-main-contact-in-person",
      },
      contactMode:
        "im-form-manage-establishment-admin__businessContact-contact-method",
      isEngagedEnterprise:
        "im-form-manage-establishment-admin__is-engaged-enterprise",
      fitForDisabledWorkers:
        "im-form-manage-establishment-admin__fit-for-disabled-workers",
      appellations: "im-form-manage-establishment-admin__appellations",
      remoteWorkMode: "im-form-manage-establishment-admin__remote-work-mode",
      website: "im-form-manage-establishment-admin__website",
      additionalInformation:
        "im-form-manage-establishment-admin__additional-information",
      maxContactsPerMonth:
        "im-form-manage-establishment-admin__max-contacts-per-month",
      maxContactsPerMonthWhenAvailable:
        "im-form-manage-establishment-admin__max-contacts-per-month-when-available",
      addAddressButton:
        "im-form-manage-establishment-admin__add-address-button",
      errorSiretAlreadyExistButton:
        "im-form-manage-establishment-admin__edit-establishment-button",
      availabilityButton:
        "im-form-manage-establishment-admin__availability-button",
      nextAvailabilityDateInput:
        "im-form-manage-establishment-admin__next-availability-date",
      maxContactsPerMonthValue:
        "im-form-manage-establishment-admin__max-contacts-per-month-value",
      nextAvailabilityDateValue:
        "im-form-manage-establishment-admin__current-next-availablity-date-value",
      offerCard: "im-form-manage-establishment-admin__offer-card",
    },
  },
  assessment: {
    form: "im-assessment-form",
    formSubmitButton: "im-assessment-form__submit-button",
    formDownloadButton: "im-assessment-form__download-button",
    statusInput: "im-assessment-form__status-input",
    partialCompletionDetailsError:
      "im-assessment-form__partial-completion-details-error",
    lastDayOfPresenceInput: "im-assessment-form__last-day-of-presence-input",
    numberOfMissedHoursInput:
      "im-assessment-form__number-of-missed-hours-input",
    numberOfMissedMinutesInput:
      "im-assessment-form__number-of-missed-minutes-input",
    endedWithAJobInput: "im-assessment-form__ended-with-a-job-input",
    typeOfContractInput: "im-assessment-form__type-of-contract-input",
    contractStartDateInput: "im-assessment-form__contract-start-date-input",
    establishmentAdvicesInput:
      "im-assessment-form__establishment-advices-input",
    establishmentFeedbackInput:
      "im-assessment-form__establishment-feedback-input",
    previousButtonForStep: ({ currentStep }) =>
      `im-assessment-form__previous-button--step-${currentStep}`,
    nextButtonFromStepAndMode: ({ currentStep }) =>
      `im-assessment-form__next-button--step-${currentStep}`,
    successMessage: "im-assessment-form__success-message",
  },
  standard: {
    siteMap: {
      home: buildSitemapNavLinkId("home"),
      candidateHome: buildSitemapNavLinkId("candidate-home"),
      establishmentHome: buildSitemapNavLinkId("establishment-home"),
      agencyHome: buildSitemapNavLinkId("agency-home"),
      search: buildSitemapNavLinkId("search"),
      coventionForm: buildSitemapNavLinkId("covention-form"),
      establishmentForm: buildSitemapNavLinkId("establishment-form"),
      agencyForm: buildSitemapNavLinkId("agency-form"),
      accessibility: buildSitemapNavLinkId("accessibility"),
      legals: buildSitemapNavLinkId("legals"),
      privacy: buildSitemapNavLinkId("privacy"),
      cgu: buildSitemapNavLinkId("cgu"),
      stats: buildSitemapNavLinkId("stats"),
    },
  },

  admin: {
    technicalOptionsTab: {
      addApiConsumerButton: "im-technical-options__add-api-consumer-button",
      editApiConsumerButton: ({ apiConsumerId }) =>
        `im-technical-options__edit-api-consumer-button--${apiConsumerId}`,
      apiConsumerModal: "im-technical-options__api-consumer-modal",
      apiConsumerForm: "im-technical-options__api-consumer-form",
      apiConsumerNameInput: "im-technical-options__api-consumer-name-input",
      apiConsumerContactLastNameInput:
        "im-technical-options__api-consumer-contact-last-name-input",
      apiConsumerContactFirstNameInput:
        "im-technical-options__api-consumer-contact-first-name-input",
      apiConsumerContactJobInput:
        "im-technical-options__api-consumer-contact-job-input",
      apiConsumerContactPhoneInput:
        "im-technical-options__api-consumer-contact-phone-input",
      apiConsumerContactEmailsInput:
        "im-technical-options__api-consumer-contact-emails-input",
      apiConsumerDescriptionInput:
        "im-technical-options__api-consumer-description-input",
      apiConsumerExpirationDateInput:
        "im-technical-options__api-consumer-expiration-date-input",
      apiConsumerRightInput: ({ rightName }) =>
        `im-technical-options__api-consumer-right-input--${rightName}`,
      apiConsumerConventionScopeInput:
        "im-technical-options__api-consumer-convention-scope-input",
      apiConsumerConventionScopeAgencyKindsInput:
        "im-technical-options__api-consumer-convention-scope-agency-kinds-input",
      apiConsumerConventionScopeAgencyIdsInput:
        "im-technical-options__api-consumer-convention-scope-agency-ids-input",

      apiConsumerSubmitButton:
        "im-technical-options__api-consumer-submit-button",
      revokeApiConsumerButton: ({ apiConsumerId }) =>
        `im-technical-options__revoke-api-consumer-button--${apiConsumerId}`,
      renewApiConsumerKeyButton: ({ apiConsumerId }) =>
        `im-technical-options__renew-api-consumer-key-button--${apiConsumerId}`,
      revokeApiConsumerModal: "im-technical-options__revoke-api-consumer-modal",
      renewApiConsumerKeyModal:
        "im-technical-options__renew-api-consumer-key-modal",
    },
    login: {
      proConnectButton: "im-login-form__inclusion-connect-button--admin",
      byEmailButton: "im-login-form__connect-button--admin-email",
      navigateToHome: "im-login-form__navigate-to-home-button--admin",
      retryButton: "im-login-form__retry-login-button--admin",
      contactSupport: "im-login-form__contact-support-link--admin",
    },
    agencyTab: {
      openManageUserModalButton:
        "im-form-edit-agency__add-user-to-agency-button",
      agencyUsersTable: "im-form-edit-agency__users-table",
      editAgencyAutocompleteInput: "im-form-edit-agency__agency-autocomplete",
      editAgencyManageUserModal: "im-form-edit-agency__manage-user-modal",
      editAgencyRemoveUserModal: "im-form-edit-agency__remove-user-modal",
      editAgencyUserRoleButton: "im-form-edit-agency__users-table-edit-button",
      editAgencyRemoveUserButton: "im-form-edit-agency__remove-user-button",
      editAgencyRemoveUserConfirmationButton:
        "im-form-edit-agency__remove-user-confirmation-button",
      editAgencyUserRoleSubmitButton:
        "im-form-edit-agency__users-submit-button",
      editAgencyManageUserCheckbox: "im-form-edit-agency__manage-user-checkbox",
      editAgencyForm: "im-form-edit-agency",
      editAgencyFormStatusSelector: "im-form-edit-agency__status-select",
      editAgencyFormStatusJustificationInput:
        "im-form-edit-agency__status-justification-input",
      editAgencyFormKindSelector: "im-form-edit-agency__kind-select",
      editAgencyFormSafirCodeInput: "im-form-edit-agency__safir-code-input",
      editAgencyFormEditSubmitButton: "im-form-edit-agency__submit-button",
      editAgencyUserEmail: "im-edit-agency-user__email",
      editAgencyUserIsNotifiedByEmail:
        "im-edit-agency-user__is-notified-by-email-toggle",
      editAgencyUserTooltip: "im-edit-agency-user__tooltip",
      selectIcUserToReview: "im-agency-user-review__select-ic-user",
      registerIcUserToAgencyButton: "im-agency-user-review__register-button",
      userRegistrationToAgencyModal:
        "im-register-user-to-agency__user-registration-modal",
      closeAgencyAndTransferConventionsModal:
        "im-close-agency-and-transfer-conventions__modal",
      closeAgencyAndTransferConventionsButton:
        "im-close-agency-and-transfer-conventions__open-button",
      closeAgencyAndTransferConventionsForm:
        "im-close-agency-and-transfer-conventions__form",
      closeAgencyAndTransferConventionsTargetAgencyIdInput:
        "im-close-agency-and-transfer-conventions__target-agency-id-input",
      closeAgencyAndTransferConventionsCancelButton:
        "im-close-agency-and-transfer-conventions__cancel-button",
      closeAgencyAndTransferConventionsSubmitButton:
        "im-close-agency-and-transfer-conventions__submit-button",
    },
    usersTab: {
      usersTable: "im-users__users-table",
    },
    userDetail: {
      preventToDeleteToggle: "im-user-detail__prevent-to-delete-toggle",
    },
    emailPreviewTab: {
      emailTemplateNameSelect: "selectTemplateName",
      internshipKindSelect: "email-preview-internshipKind-select",
    },
    manageEstablishment: {
      siretInput: "im-manage-establishment__siret-input",
      searchButton: "im-manage-establishment__search-button",
      titleInput: "im-form-add-by-batch__title-input",
      descriptionInput: "im-form-add-by-batch__description-input",
      groupNameInput: "im-form-add-by-batch__group-name-input",
      inputFileInput: "im-form-add-by-batch__input-file-input",
      submitEditButton:
        "im-form-manage-establishment-admin__submit-edit-button",
      submitDeleteButton:
        "im-form-manage-establishment-admin__submit-delete-button",
      banButton: "im-manage-establishment__ban-button",
    },
    adminPrivateRoute: {
      formLoginUserInput: "im-login__user-input",
      formLoginPasswordInput: "im-login__password-input",
      formLoginSubmitButton: "im-login__submit-button",
    },
  },
  myAccount: {
    firstName: "im-profile__first-name",
    lastName: "im-profile__last-name",
    email: "im-profile__email",
    editRoleButton: "im-profile__edit-role-button",
    adminAgencyLink: "im-profile__admin-agency-link",
    adminEstablishmentLink: "im-profile__admin-establishment-link",
    cancelRegistrationButton: "im-profile__cancel-registration-button",
    removeAgencyRightButton: "im-profile__remove-agency-right-button",
    removeAgencyRightModal: "im-profile__remove-agency-right-modal",
    updateOwnInfosLink: "im-profile__update-own-infos-link",
    editAgencyUserEmail: "im-profile-edit-agency-user__email",
    editAgencyManageUserCheckbox:
      "im-profile-form-edit-agency__manage-user-checkbox",
    editAgencyUserIsNotifiedByEmail:
      "im-profile-edit-agency-user__is-notified-by-email-toggle",
    editAgencyUserRoleSubmitButton:
      "im-profile-form-edit-agency__users-submit-button",
    registerAgenciesSearchLink: "im-profile__register-agencies-search-link",
    registerAgencyButton: "im-profile__register-agency-button",
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--my-profile-establishment-registration",
      byEmailButton:
        "im-login-form__connect-button--my-profile-establishment-registration-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--my-profile-establishment-registration",
      retryButton:
        "im-login-form__retry-login-button--my-profile-establishment-registration",
      contactSupport:
        "im-login-form__contact-support-link--my-profile-establishment-registration",
    },
  },
  myAccountEstablishmentRegistration: {
    registerEstablishmentButton: "im-profile__register-establishment-button",
    registerEstablishmentSearch: "im-register-establishment__search",
  },
  conventionStatusDashboard: {},
  group: {},
  conventionDocument: {
    downloadPdfButton: "im-convention-document__download-pdf-button",
  },
  assessmentDocument: {
    downloadPdfButton: "im-assessment-document__download-pdf-button",
    cancelSignAssessmentButton:
      "im-assessment-document__cancel-sign-assessment-button",
    openSignAssessmentModalButton:
      "im-assessment-document__open-sign-assessment-modal-button",
    signAssessmentButton: "im-assessment-document__sign-assessment-button",
    signAssessmentModal: "im-assessment-document__sign-assessment-modal",
    signAssessmentForm: "im-assessment-document__sign-assessment-form",
  },
  conventionToSign: {
    form: "im-convention-to-sign-form",
    submitButton: "im-convention-to-sign__submit-button",
    openSignModalButton: "im-convention-to-sign__open-sign-modal-button",
    modificationButton: "im-convention-to-sign__modification-button",
  },

  conventionMiniStage: {},

  agencyDashboard: {
    login: {
      proConnectButton: "im-login-form__inclusion-connect-button--agency",
      byEmailButton: "im-login-form__connect-button--agency-email",
      navigateToHome: "im-login-form__navigate-to-home-button--agency",
      retryButton: "im-login-form__retry-login-button--agency",
      contactSupport: "im-login-form__contact-support-link--agency",
    },
    registerAgencies: {
      newAgencyButton: "im-register-agencies__new-agency-button",
      showRegistrationFormButton:
        "im-register-agencies__show-registration-form-button",
      table: "im-register-agencies-table",
      search: "im-register-agencies__search",
      submitButton: "im-register-agencies__submit-button",
    },
    dashboard: {
      tabContainer: "im-agency-dashboard__tab-container",
      goToConventionButton: "im-agency-dashboard__go-to-convention-button",
    },
    initiateConvention: {
      button: "im-agency-dashboard__initiate-convention-button",
      modalButton: "im-agency-dashboard__initiate-convention-modal-button",
      modal: "im-agency-dashboard__select-agency-to-initiate-convention-modal",
      sourceRadioButtons:
        "im-agency-dashboard__initiate-convention-source-radio-buttons",
      templateRadioButtons:
        "im-agency-dashboard__initiate-convention-template-radio-buttons",
    },
    agencyTab: {
      adminRightsModal: "im-agency-dashboard__agency-tab-admin-rights-modal",
      userRightsModal: "im-agency-dashboard__agency-tab-user-rights-modal",
    },
    agencyDetails: {
      editAgencyForm: "im-agency-dashboard-form-edit-agency",
      editAgencyFormEditSubmitButton:
        "im-agency-dashboard-form-edit-agency__submit-button",
      editAgencyUserEmail: "im-agency-dashboard-edit-agency-user__email",
      editAgencyManageUserCheckbox:
        "im-agency-dashboard-form-edit-agency__manage-user-checkbox",
      editAgencyUserIsNotifiedByEmail:
        "im-agency-dashboard-edit-agency-user__is-notified-by-email-toggle",
      editAgencyUserRoleSubmitButton:
        "im-agency-dashboard-form-edit-agency__users-submit-button",
      editAgencyManageUserModal:
        "im-agency-dashboard-form-edit-agency__manage-user-modal",
      editAgencyRemoveUserModal:
        "im-agency-dashboard-form-edit-agency__remove-user-modal",
      openManageUserModalButton:
        "im-agency-dashboard-form-edit-agency__add-user-to-agency-button",
      agencyUsersTable: "im-agency-dashboard-form-edit-agency__users-table",
      editAgencyUserRoleButton:
        "im--agency-dashboard-form-edit-agency__users-table-edit-button",
      editAgencyRemoveUserButton:
        "im-agency-dashboard-form-edit-agency__remove-user-button",
    },
  },
  manageConventionConnectedUser: {
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--manage-convention-user-connected",
      byEmailButton:
        "im-login-form__connect-button--manage-convention-user-connected-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--manage-convention-user-connected",
      retryButton:
        "im-login-form__retry-login-button--manage-convention-user-connected",
      contactSupport:
        "im-login-form__contact-support-link--manage-convention-user-connected",
    },
    erroredConventionHandledModal:
      "im-errored-convention-handled-confirmation-modal",
    pilotConventionWithBroadcastErrorButton:
      "im-manage-convention-user-connected__pilot-convention-with-broadcast-error-button",
    pilotConventionToManageButton:
      "im-manage-convention-user-connected__pilot-convention-to-manage-button",
    pilotConventionWithUnfinalizedAssessmentButton:
      "im-manage-convention-user-connected__pilot-convention-with-unfinalized-assessment-button",
  },
  establishmentDashboardDiscussions: {
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--manage-discussion",
      byEmailButton: "im-login-form__connect-button--manage-discussion-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--manage-discussion",
      retryButton: "im-login-form__retry-login-button--manage-discussion",
      contactSupport: "im-login-form__contact-support-link--manage-discussion",
    },
  },
  magicLinkInterstitial: {
    confirmLoginButton: "im-magic-link-interstitial__confirm-login-button",
    renewalButton: "im-magic-link-interstitial__renewal-button",
  },
  adminEstablishments: {},
  establishmentDashboard: {
    tabContainer: "im-establishment-dashboard__tab-container",
    initiateConvention: {
      button: "im-establishment-dashboard__initiate-convention-button",
      modal: "im-manage-establishment__initiate-convention-modal",
      modalButton: "im-manage-establishment__initiate-convention-modal-button",
      establishmentSelect:
        "im-manage-establishment__initiate-convention-establishment-select",
      appellationSelect:
        "im-manage-establishment__initiate-convention-appellation-select",
      addressSelect:
        "im-manage-establishment__initiate-convention-address-select",
      sourceRadioButtons:
        "im-manage-establishment__initiate-convention-source-radio-buttons",
      templateRadioButtons:
        "im-manage-establishment__initiate-convention-template-radio-buttons",
    },
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--establishment-dashboard",
      byEmailButton:
        "im-login-form__connect-button--establishment-dashboard-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--establishment-dashboard",
      retryButton: "im-login-form__retry-login-button--establishment-dashboard",
      contactSupport:
        "im-login-form__contact-support-link--establishment-dashboard",
    },
    discussion: {
      acceptDiscussionForm: "im-manage-establishment__accept-discussion-form",
      rejectDiscussionForm: "im-manage-establishment__reject-discussion-form",
      activateDraftConvention:
        "im-manage-establishment__convert-discussion-to-draft-convention",
      replyToCandidateByEmail:
        "im-manage-establishment__reply-to-candidate-by-email",
      acceptDiscussionModal: "im-manage-establishment__accept-discussion",
      acceptDiscussionButton:
        "im-manage-establishment__accept-discussion-button-open-modal",
      acceptDiscussionSubmitButton:
        "im-manage-establishment__accept-discussion-modal-submit-button",
      acceptDiscussionCancelButton:
        "im-manage-establishment__accept-discussion-cancel-button",
      acceptDiscussionConventionIdInput:
        "im-manage-establishment__accept-discussion-convention-id-input",
      rejectDiscussionModal: "im-manage-establishment__reject-discussion",
      rejectDiscussionIsCandidateWarned:
        "im-manage-establishment__reject-discussion-is-candidate-warned",
      rejectDiscussionButton:
        "im-manage-establishment__reject-discussion-button",
      rejectDiscussionJustificationKindInput:
        "im-manage-establishment__reject-discussion-justification-kind-input",
      rejectDiscussionJustificationReasonInput:
        "im-manage-establishment__reject-discussion-justification-text-input",
      rejectDiscussionSubmitPreviewButton:
        "im-manage-establishment__reject-discussion-submit-preview-button",
      rejectDiscussionSubmitButton:
        "im-manage-establishment__reject-discussion-submit-button",
      rejectDiscussionCancelButton:
        "im-manage-establishment__reject-discussion-cancel-button",
      statusBadge: "im-manage-establishment__discussion-status-badge",
      followUpBadge: "im-manage-establishment__discussion-follow-up-badge",
      merBadge: "im-manage-establishment__discussion-mer-badge",
      copyEmailButton: "im-manage-establishment__discussion-copy-email-button",
      sendMessageInput:
        "im-manage-establishment__discussion-send-message-input",
      sendMessageSubmitButton:
        "im-manage-establishment__discussion-send-message-submit-button",
    },
    manageConventionForm: {
      submitButton: "im-manage-establishment__manage-convention-submit-button",
    },
    manageDiscussion: {
      submitButton: "im-manage-establishment__manage-discussion-submit-button",
      discussionIdInput: "im-manage-establishment__manage-discussion-id-input",
      goToDiscussionButton: "im-manage-establishment__go-to-discussion-button",
    },
    manageEstablishments: {
      selectEstablishmentInput: "im-manage-establishment__establishment-select",
      addUserButton: "im-manage-establishment__add-user-button",
      createEstablishment:
        "im-manage-establishment__create-establishment-button",
      editUserButton: "im-manage-establishment__edit-user-button",
      deleteUserButton: "im-manage-establishment__delete-user-button",
      validateUserRightButton:
        "im-manage-establishment__validate-user-right-button",
      rejectUserRightButton:
        "im-manage-establishment__reject-user-right-button",
    },
  },
  initiateConvention: {
    navCards: {
      candidate: "im-initiate-convention-page__nav-card-candidate",
      establishment: "im-initiate-convention-page__nav-card-establishment",
      agency: "im-initiate-convention-page__nav-card-agency",
      help: "im-initiate-convention-page__nav-card-help",
    },
    ftConnectButton: "im-convention-form__initiate-ft-connect-button",
    iHaveAProblemButton: "im-convention-form__initiate-i-have-a-problem-button",
    canIFillOnline: "im-convention-form__initiate-can-i-fill-online-link",
    otherStructureButton: "im-convention-form__initiate-other-structure-button",
    noStructureButton: "im-convention-form__initiate-no-structure-button",
    dontKnowCategoryButton:
      "im-convention-form__initiate-dont-know-category-button",
  },
  beneficiaryDashboard: {
    tabContainer: "im-beneficiary-dashboard__tab-container",
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--beneficiary-dashboard",
      byEmailButton:
        "im-login-form__connect-button--beneficiary-dashboard-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--beneficiary-dashboard",
      retryButton: "im-login-form__retry-login-button--beneficiary-dashboard",
      contactSupport:
        "im-login-form__contact-support-link--beneficiary-dashboard",
    },
    manageDiscussions: {
      goToDiscussionButton: "im-beneficiary-dashboard__go-to-discussion-button",
    },
  },
  beneficiaryDashboardConventions: {
    beneficiaryConventionListHelpdeskNoConventionHint:
      "im-beneficary-convention-list__no-convention-helpdesk-hint",
    goToConventionButton:
      "im-beneficiary-convention-list__see-convention-button",
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--beneficiary-dashboard-conventions",
      byEmailButton:
        "im-login-form__connect-button--beneficiary-dashboard-conventions-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--beneficiary-dashboard-conventions",
      retryButton:
        "im-login-form__retry-login-button--beneficiary-dashboard-conventions",
      contactSupport:
        "im-login-form__contact-support-link--beneficiary-dashboard-conventions",
    },
  },
  beneficiaryDashboardDiscussions: {
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--beneficiary-dashboard-discussions",
      byEmailButton:
        "im-login-form__connect-button--beneficiary-dashboard-discussions-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--beneficiary-dashboard-discussions",
      retryButton:
        "im-login-form__retry-login-button--beneficiary-dashboard-discussions",
      contactSupport:
        "im-login-form__contact-support-link--beneficiary-dashboard-discussions",
    },
    displayPhoneContactButton:
      "im-beneficiary-discussion_display-phone-contact-button",
  },
  archivedConventionRequest: {
    form: "im-archived-convention-request__form",
    conventionSearchMethod:
      "im-archived-convention-request__convention-search-method",
    conventionIdInput: "im-archived-convention-request__convention-id-input",
    beneficiaryFirstNameInput:
      "im-archived-convention-request__beneficiary-first-name-input",
    beneficiaryLastNameInput:
      "im-archived-convention-request__beneficiary-last-name-input",
    siretInput: "im-archived-convention-request__siret-input",
    immersionDateInput: "im-archived-convention-request__immersion-date-input",
    appellationAutocomplete:
      "im-archived-convention-request__appellation-autocomplete",
    reasonSelect: "im-archived-convention-request__reason-select",
    otherReasonInput: "im-archived-convention-request__other-reason-input",
    submitButton: "im-archived-convention-request__submit-button",
    success: {
      goToMyAccountButton:
        "im-archived-convention-request-success__go-to-my-account-button",
      newRequestButton:
        "im-archived-convention-request-success__new-request-button",
    },
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--archived-convention-request",
      byEmailButton:
        "im-login-form__connect-button--archived-convention-request-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--archived-convention-request",
      retryButton:
        "im-login-form__retry-login-button--archived-convention-request",
      contactSupport:
        "im-login-form__contact-support-link--archived-convention-request",
    },
  },
  conventionTemplate: {
    login: {
      proConnectButton:
        "im-login-form__pro-connect-button--agency-dashboard-convention-template",
      byEmailButton:
        "im-login-form__pro-connect-button--agency-dashboard-convention-template-email",
      navigateToHome:
        "im-login-form__navigate-to-home-button--agency-dashboard-convention-template",
      retryButton:
        "im-login-form__retry-login-button--agency-dashboard-convention-template",
      contactSupport:
        "im-login-form__contact-support-link--agency-dashboard-convention-template",
    },
    form: {
      nameInput: "im-convention-template-form__name-input",
      submitFormButton: "im-convention-template-form__submit-button",
      submitFormButtonMobile:
        "im-convention-template-form__submit-form-button--mobile",
    },
    createConventionTemplateButton:
      "im-agency-dashboard__create-convention-template-button",
    editConventionTemplateButton:
      "im-manage-convention-template__edit-convention-template-button",
    deleteConventionTemplateButton:
      "im-manage-convention-template__delete-convention-template-button",
    deleteConventionTemplate: {
      modal: "im-manage-convention-template__delete-convention-template-modal",
      cancelButton:
        "im-manage-convention-template__delete-convention-template-cancel-button",
      confirmButton:
        "im-manage-convention-template__delete-convention-template-confirm-button",
    },
    shareAsConventionDraft: {
      button: "im-manage-convention-template__share-as-convention-draft-button",
      modal: "im-manage-convention-template__share-as-convention-draft-modal",
      form: "im-manage-convention-template__share-as-convention-draft-modal-form",
      emailInput:
        "im-manage-convention-template__share-as-convention-draft-email-input",
      messageInput:
        "im-manage-convention-template__share-as-convention-draft-message-input",
      cancelButton:
        "im-manage-convention-template__share-as-convention-draft-cancel-button",
      submitButton:
        "im-manage-convention-template__share-as-convention-draft-submit-button",
    },
  },
  adminAgencies: {},
  adminConventions: {},
  adminEvents: {},
  adminUsers: {},
  adminNotifications: {},
  adminEmailPreview: {},
  adminTechnicalOptions: {},
  adminConventionDetail: {},
  adminUserDetail: {},
  adminUserDetailAgencies: {},
  adminUserDetailEstablishments: {},
  adminAgencyDetail: {},
  agencyDashboardMain: {},
  agencyDashboardOnboarding: {},
  statsEstablishmentDetails: {},
  agencyManagement: {},
  establishmentManagement: {},
  myAccountAgencies: {},
  myAccountEstablishments: {},
  myAccountAgencyRegistration: {},
  agencyDashboardAgencies: {
    userRegistrationToAgency: {
      modal: "im-agency-dashboard-agencies__user-registration-to-agency-modal",
    },
  },
  agencyDashboardAgencyDetails: {
    login: {
      proConnectButton:
        "im-login-form__inclusion-connect-button--agency-detail",
      byEmailButton: "im-login-form__connect-button--agency-detail-email",
      navigateToHome: "im-login-form__navigate-to-home-button--agency-detail",
      retryButton: "im-login-form__retry-login-button--agency-detail",
      contactSupport: "im-login-form__contact-support-link--agency-detail",
    },
  },
  conventionConfirmation: {},
  conventionImmersionForExternals: {},
  establishmentDashboardConventions: {},
  establishmentDashboardFormEstablishment: {},
  openApiDoc: {},
  stats: {},
  temporaryError: {
    initiateConventionButton: "im-error__initiate-convention-button",
    establishmentDashboardButton: "im-error__establishment-dashboard-button",
    homeButton: "im-error__home-button",
    contactUsButton: "im-error__contact-us-button",
  },
} satisfies DomElementIds;
