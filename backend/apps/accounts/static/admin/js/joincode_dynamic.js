document.addEventListener('DOMContentLoaded', function () {
    const roleSelect = document.getElementById('id_role');
    if (!roleSelect) return;

    const institutionRow = document.querySelector('.field-institution');
    const sectionRow = document.querySelector('.field-section');
    const districtRow = document.querySelector('.field-district');

    function toggleFields() {
        const role = roleSelect.value;

        if (role === 'OFFICIAL') {
            // Official → only District
            institutionRow.style.display = 'none';
            sectionRow.style.display = 'none';
            districtRow.style.display = 'table-row';
        }
        else if (role === 'PRINCIPAL') {
            // Principal → only Institution (no Section)
            institutionRow.style.display = 'table-row';
            sectionRow.style.display = 'none';
            districtRow.style.display = 'none';
        }
        else {
            // Teacher / Student → Institution + Section
            institutionRow.style.display = 'table-row';
            sectionRow.style.display = 'table-row';
            districtRow.style.display = 'none';
        }
    }

    toggleFields();
    roleSelect.addEventListener('change', toggleFields);
});