"use strict";
/// <reference path="../node_modules/@types/jquery/index.d.ts" />
$(() => {
    $("#btnForm").on("click", (e) => {
        e.preventDefault();
        let legajo = $("#legajo").val();
        let apodo = $("#apodo").val();
        let dato = {};
        dato.legajo = legajo;
        dato.apodo = apodo;
        $.ajax({
            type: 'POST',
            url: URL_API + "login",
            dataType: "json",
            data: dato,
            async: true
        })
            .done(function (obj_ret) {
            console.log(obj_ret);
            let alerta = "";
            if (obj_ret.exito) {
                //GUARDO EN EL LOCALSTORAGE
                localStorage.setItem("jwt", obj_ret.jwt);
                alerta = ArmarAlert(obj_ret.mensaje + " redirigiendo al principal.php...");
                setTimeout(() => {
                    $(location).attr('href', URL_BASE + "principal.html");
                }, 2000);
            }
            $("#div_mensaje").html(alerta);
        })
            .fail(function (jqXHR, textStatus, errorThrown) {
            let retorno = JSON.parse(jqXHR.responseText);
            let alerta = ArmarAlert(retorno.mensaje, "danger");
            $("#div_mensaje").html(alerta);
        });
    });
});
//# sourceMappingURL=script.js.map