import React, { useState, useContext, useEffect } from 'react'
import Modal from 'react-modal'
import { GlobalContext } from '../context'
import { Line } from 'rc-progress'
import { Record } from 'immutable'
import {
  FormGroup,
  FormRow,
  Button,
  Checkbox,
  TextFormUnderline,
  SelectForm,
  MultiSelectForm
} from './forms.js'
import {
  Q_FUNC_TYPE_OPTIONS,
  SCALER_OPTIONS,
  IMAGE_AUGMENTATION_OPTIONS,
  VECTOR_AUGMENTATION_OPTIONS,
  CONTINUOUS_CONFIGS,
  DISCRETE_CONFIGS
} from '../constants'
import '../styles/dialog.scss'
import '../styles/create-experiment-dialog.scss'

const modalStyles = {
  content: {
    width: '600px',
    height: '420px',
    top: '18%',
    left: '30%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    padding: '32px',
    'box-shadow': '10px 10px 20px 20px rgba(0, 0, 0, 0.1)'
  }
}

function convertSnakeToUpper (text) {
  return text.toUpperCase().replace(/_/g, ' ')
}

function getTimestamp () {
  const date = new Date()
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  ].join('')
}

function ConfigForm (props) {
  const dataset = props.dataset

  if (props.label === 'q_func_type') {
    const options = Object.entries(Q_FUNC_TYPE_OPTIONS)
      .map(([key, value]) => {
        return { text: value, value: key }
      })
    return (
      <SelectForm
        options={options}
        value={props.value}
        onChange={(newValue) => props.onChange(props.label, newValue)}
      />
    )
  } else if (props.label === 'scaler') {
    const options = Object.entries(SCALER_OPTIONS)
      .map(([key, value]) => {
        return { text: value, value: key }
      })
    return (
      <SelectForm
        options={options}
        value={props.value}
        onChange={(newValue) => {
          props.onChange(props.label, newValue === 'null' ? null : newValue)
        }}
      />
    )
  } else if (props.label === 'augmentation') {
    const augmentations = dataset.isImage ? IMAGE_AUGMENTATION_OPTIONS
      : VECTOR_AUGMENTATION_OPTIONS
    const options = Object.entries(augmentations)
      .map(([key, value]) => {
        return { text: value, value: key }
      })
    return (
      <FormRow>
        <MultiSelectForm
          options={options}
          onChange={(newValue) => props.onChange(props.label, newValue)}
          value={props.value}
        />
      </FormRow>
    )
  } else if (props.label === 'use_gpu') {
    const options = [{ text: 'CPU', value: null }]
    if (props.status.gpu !== undefined) {
      for (let i = 0; i < props.status.gpu.total; ++i) {
        options.push({ text: `GPU:${i}`, value: i })
      }
    }
    return (
      <SelectForm
        options={options}
        value={props.value}
        onChange={(newValue) => {
          const value = newValue === 'null' ? null : Number(newValue)
          props.onChange(props.label, value)
        }}
      />
    )
  } else if ((typeof props.value) === 'boolean') {
    return (
      <FormRow>
        <Checkbox
          text=''
          value={props.value}
          onChange={(check) => props.onChange(props.label, check)}
        />
      </FormRow>
    )
  } else {
    return (
      <TextFormUnderline
        value={props.value}
        onChange={(newValue) => props.onChange(props.label, Number(newValue))}
      />
    )
  }
}

function ConfigForms (props) {
  const dataset = props.dataset
  return (
    <table className='form-table'>
      {Object.entries(props.config).map(([key, value]) => {
        // handle special labels
        let label = convertSnakeToUpper(key)
        if (key === 'use_gpu') {
          label = 'DEVICE'
        }
        return (
          <tr key={key}>
            <th>{label}</th>
            <td>
              <ConfigForm
                label={key}
                value={value}
                onChange={props.onChange}
                status={props.status}
                dataset={dataset}
              />
            </td>
          </tr>
        )
      })}
    </table>
  )
}

Modal.setAppElement('#root')

export function ExperimentCreateDialog (props) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [experimentName, setExperimentName] = useState('')
  const [basicConfig, setBasicConfig] = useState(Record({})())
  const [advancedConfig, setAdvancedConfig] = useState(Record({})())
  const [isShowingAdvancedConfig, setIsShowingAdvancedConfig] = useState(false)
  const { status, createExperiment } = useContext(GlobalContext)

  const dataset = props.dataset
  const project = props.project
  const algorithm = project.algorithm
  const configs = dataset.isDiscrete ? DISCRETE_CONFIGS : CONTINUOUS_CONFIGS

  useEffect(() => {
    setExperimentName(algorithm.toUpperCase() + '_' + getTimestamp())

    // default scaling option based on observation type
    const scaler = dataset.isImage ? 'pixel' : null
    const basicConfig = Record(configs[algorithm].basic_config)()
    setBasicConfig(basicConfig.set('scaler', scaler))

    setAdvancedConfig(Record(configs[algorithm].advanced_config)())
  }, [props.isOpen])

  const handleClose = () => {
    setUploadProgress(0)
    setBasicConfig(Record({})())
    setAdvancedConfig(Record({})())
    setExperimentName('')
    setIsShowingAdvancedConfig(false)
    props.onClose()
  }

  const handleSubmit = () => {
    // quick validation
    if (experimentName === '') {
      return
    }

    setIsUploading(true)
    const progressCallback = (e) => {
      const progress = Math.round(e.loaded * 100 / e.total)
      setUploadProgress(progress)
    }

    // concat basic configs and advanced configs
    const config = Object.assign(basicConfig.toJS(), advancedConfig.toJS())

    createExperiment(project.id, experimentName, config, progressCallback)
      .then((project) => {
        setIsUploading(false)
        handleClose()
      })
  }

  const handleBasicConfigChange = (key, value) => {
    setBasicConfig(basicConfig.set(key, value))
  }
  const handleAdvancedConfigChange = (key, value) => {
    setAdvancedConfig(advancedConfig.set(key, value))
  }

  return (
    <Modal
      isOpen={props.isOpen}
      contentLabel='Run experiment'
      style={modalStyles}
      onRequestClose={handleClose}
    >
      <div>
        <p className='dialog-title'>Run experiment</p>
        <FormRow>
          <TextFormUnderline
            value={experimentName}
            placeholder='EXPERIMENT NAME'
            onChange={(name) => setExperimentName(name)}
          />
        </FormRow>
        <ConfigForms
          config={basicConfig.toJS()}
          status={status}
          onChange={handleBasicConfigChange}
          dataset={dataset}
        />
        {!isShowingAdvancedConfig &&
          <div className='advanced-config-button'>
            <Button
              text='SHOW ADVANCED CONFIGURATIONS'
              onClick={() => setIsShowingAdvancedConfig(true)}
            />
          </div>}
        {isShowingAdvancedConfig &&
          <div className='advanced-config-button'>
            <Button
              text='HIDE ADVANCED CONFIGURATIONS'
              onClick={() => setIsShowingAdvancedConfig(false)}
            />
          </div>}
        {isShowingAdvancedConfig &&
          <ConfigForms
            config={advancedConfig.toJS()}
            status={status}
            onChange={handleAdvancedConfigChange}
            dataset={props.dataset}
          />}
        <FormGroup>
          <Button text='SUBMIT' onClick={handleSubmit} />
          <Button text='CANCEL' onClick={handleClose} />
        </FormGroup>
        {isUploading &&
          <Line
            percent={uploadProgress}
            strokeWidth='1'
            strokeColor='#2980b9'
          />}
      </div>
    </Modal>
  )
}
