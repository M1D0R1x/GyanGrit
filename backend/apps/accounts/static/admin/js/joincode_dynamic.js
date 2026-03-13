document.addEventListener('DOMContentLoaded', function () {

    const roleSelect = document.getElementById('id_role')

    const institutionRow = document.querySelector('.field-institution')
    const sectionRow = document.querySelector('.field-section')
    const districtRow = document.querySelector('.field-district')
    const subjectRow = document.querySelector('.field-subject')

    function toggleFields(){

        const role = roleSelect.value

        if(role === "OFFICIAL"){
            institutionRow.style.display="none"
            sectionRow.style.display="none"
            if(subjectRow) subjectRow.style.display="none"
            districtRow.style.display="table-row"
        }

        else if(role === "PRINCIPAL"){
            institutionRow.style.display="table-row"
            sectionRow.style.display="none"
            if(subjectRow) subjectRow.style.display="none"
            districtRow.style.display="table-row"
        }

        else if(role === "TEACHER"){
            institutionRow.style.display="table-row"
            sectionRow.style.display="none"
            if(subjectRow) subjectRow.style.display="table-row"
            districtRow.style.display="table-row"
        }

        else{
            institutionRow.style.display="table-row"
            sectionRow.style.display="table-row"
            if(subjectRow) subjectRow.style.display="none"
            districtRow.style.display="table-row"
        }

    }

    toggleFields()
    roleSelect.addEventListener("change",toggleFields)

})