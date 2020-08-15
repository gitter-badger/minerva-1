import json
import uuid

from flask import Blueprint, request, jsonify
from werkzeug.exceptions import NotFound
from sqlalchemy import desc
from ..database import db
from ..models.project import Project, ProjectSchema
from ..models.experiment import Experiment, ExperimentSchema

project_route = Blueprint('project', __name__)


@project_route.route('/', methods=['GET'])
def get_all_projects():
    projects = db.session.query(Project)\
        .order_by(desc(Project.id))\
        .all()

    project_schema = ProjectSchema(many=True)
    return jsonify({
        'projects': project_schema.dump(projects),
        'total': len(projects)
    })


@project_route.route('/', methods=['POST'])
def create_project():
    json = request.get_json()
    dataset_id = json['dataset_id']
    name = json['name']
    project = Project.create(dataset_id, name, 'cql')
    return jsonify(ProjectSchema().dump(project))


@project_route.route('/<project_id>', methods=['GET'])
def get_project(project_id):
    project = Project.get(project_id, raise_404=True)
    return jsonify(ProjectSchema().dump(project))


@project_route.route('/<project_id>', methods=['PUT'])
def update_project(project_id):
    project = Project.get(project_id, raise_404=True)
    json = request.get_json()
    project.name = json['name']
    project.update()
    return jsonify(ProjectSchema().dump(project))


@project_route.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.get(project_id, raise_404=True)
    project.delete()
    return jsonify({})


def _process_metrics(experiment, data):
    current_status = experiment.get_current_status()
    if experiment.is_active and not current_status:
        experiment.is_active = False
        experiment.update()
    data['metrics'] = experiment.get_metrics()


@project_route.route('/<project_id>/experiments', methods=['GET'])
def get_all_experiments(project_id):
    experiments = db.session.query(Experiment)\
        .filter(Experiment.project_id == int(project_id))\
        .order_by(desc(Experiment.id))\
        .all()

    experiment_schema = ExperimentSchema(many=True)
    data = experiment_schema.dump(experiments)

    # update status
    for experiment, json_data in zip(experiments, data):
        _process_metrics(experiment, json_data)

    return jsonify({'experiments': data, 'total': len(experiments)})


@project_route.route('/<project_id>/experiments/<experiment_id>',
                     methods=['GET'])
def get_experiment(project_id, experiment_id):
    experiment = Experiment.get(experiment_id, raise_404=True)
    if experiment.project_id != int(project_id):
        return NotFound()

    data = ExperimentSchema().dump(experiment)

    _process_metrics(experiment, data)

    return jsonify(data)


@project_route.route('/<project_id>/experiments', methods=['POST'])
def create_experiment(project_id):
    json_data = request.get_json()
    name = json_data['name']
    config = json_data['config']
    log_name = str(uuid.uuid1())
    experiment = Experiment.create(project_id, name, log_name,
                                   json.dumps(config))

    # start training
    experiment.start_training()

    data = ExperimentSchema().dump(experiment)
    data['metrics'] = {}

    return jsonify(data)


@project_route.route('/<project_id>/experiments/<experiment_id>',
                     methods=['PUT'])
def update_experiment(project_id, experiment_id):
    experiment = Experiment.get(experiment_id, raise_404=True)
    if experiment.project_id != int(project_id):
        return NotFound()

    json = request.get_json()
    experiment.name = json['name']
    experiment.update()

    data = ExperimentSchema().dump(experiment)
    data['metrics'] = {}

    return jsonify(data)


@project_route.route('/<project_id>/experiments/<experiment_id>',
                     methods=['DELETE'])
def delete_experiment(project_id, experiment_id):
    experiment = Experiment.get(experiment_id, raise_404=True)
    if experiment.project_id != int(project_id):
        return NotFound()
    experiment.delete()
    return jsonify({})


@project_route.route('/<project_id>/experiments/<experiment_id>/cancel',
                     methods=['POST'])
def cancel_experiment(project_id, experiment_id):
    experiment = Experiment.get(experiment_id, raise_404=True)
    if experiment.project_id != int(project_id):
        return NotFound()

    # kill training process
    experiment.cancel_training()

    data = ExperimentSchema().dump(experiment)

    _process_metrics(experiment, data)

    return jsonify(data)