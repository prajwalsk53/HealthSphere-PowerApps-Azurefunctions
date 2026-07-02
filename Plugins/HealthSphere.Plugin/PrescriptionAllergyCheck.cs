using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace HealthSphere.Plugins
{
    public class PrescriptionAllergyCheck : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider
                .GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider
                .GetService(typeof(IOrganizationServiceFactory));
            var tracing = (ITracingService)serviceProvider
                .GetService(typeof(ITracingService));

            var service = factory.CreateOrganizationService(context.UserId);

            // Only run on Create of hs_prescription, Pre-validation stage
            if (context.MessageName != "Create" || !context.InputParameters.Contains("Target"))
                return;

            var prescription = (Entity)context.InputParameters["Target"];

            // Get medication name and patient from the new prescription
            var medication = prescription.GetAttributeValue<string>("hs_medicationname");
            var patientRef = prescription.GetAttributeValue<EntityReference>("hs_patient");

            if (string.IsNullOrWhiteSpace(medication) || patientRef == null)
                return;

            tracing.Trace($"Checking allergies for patient {patientRef.Id}, medication: {medication}");

            // Query all allergies for this patient
            var query = new QueryExpression("hs_allergy")
            {
                ColumnSet = new ColumnSet("hs_allergen", "hs_severity"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            "hs_patient",
                            ConditionOperator.Equal,
                            patientRef.Id)
                    }
                }
            };

            var allergies = service.RetrieveMultiple(query).Entities;
            tracing.Trace($"Found {allergies.Count} allergies for patient");

            // Check if any allergen matches the medication (case-insensitive, partial match)
            var match = allergies.FirstOrDefault(a =>
            {
                var allergen = a.GetAttributeValue<string>("hs_allergen") ?? "";
                return allergen.IndexOf(medication, StringComparison.OrdinalIgnoreCase) >= 0
                    || medication.IndexOf(allergen, StringComparison.OrdinalIgnoreCase) >= 0;
            });

            if (match != null)
            {
                var allergen = match.GetAttributeValue<string>("hs_allergen");
                var severity = match.FormattedValues.ContainsKey("hs_severity")
                    ? match.FormattedValues["hs_severity"]
                    : "unknown severity";

                throw new InvalidPluginExecutionException(
                    $"⚠️ Prescription blocked: Patient has a known {severity} allergy to '{allergen}'. " +
                    $"The prescribed medication '{medication}' may conflict. " +
                    $"Please review the patient's allergy records before prescribing.");
            }
        }
    }
}
