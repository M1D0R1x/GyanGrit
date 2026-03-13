document.addEventListener('DOMContentLoaded', function () {

    const roleSelect = document.getElementById('id_role')

    const institutionRow = document.querySelector('.field-institution')
    const sectionRow = document.querySelector('.field-section')
    const districtRow = document.querySelector('.field-district')
    const subjectRow = document.querySelector('.field-subject')  // NEW

    function toggleFields(){

        const role = roleSelect.value

        if(role === "OFFICIAL"){
            institutionRow.style.display="none"
            sectionRow.style.display="none"
            subjectRow.style.display="none"  // NEW: hide subject
            districtRow.style.display="table-row"
        }

        else if(role === "PRINCIPAL"){
            institutionRow.style.display="table-row"
            sectionRow.style.display="none"
            subjectRow.style.display="none"  // NEW: hide subject
            districtRow.style.display="table-row"
        }

        else if(role === "TEACHER"){
            institutionRow.style.display="table-row"
            sectionRow.style.display="none"  // Hide section for teacher
            subjectRow.style.display="table-row"  // NEW: show subject
            districtRow.style.display="table-row"
        }

        else{  // STUDENT
            institutionRow.style.display="table-row"
            sectionRow.style.display="table-row"
            subjectRow.style.display="none"  // NEW: hide subject
            districtRow.style.display="table-row"
        }

    }

    toggleFields()
    roleSelect.addEventListener("change",toggleFields)

})