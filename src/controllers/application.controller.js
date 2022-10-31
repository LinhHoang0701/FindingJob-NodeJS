'use strict'

const httpStatus = require('http-status')
const sql = require('./../services/sql')
const mongoose = require('mongoose')
const APIError = require('../utils/APIError')
const Job = require('../models/job.model')
const Applicant = require('../models/applicant.model')
const Application = require('../models/application.model')

exports.apply = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) throw new APIError(`Invalid jobId`, httpStatus.BAD_REQUEST)
    const response = { payLoad: {} }
    const applicationData = req.body
    applicationData.jobId = req.params.jobId
    const previouslyApplied = await sql.query(`SELECT COUNT(*) as count FROM job_application WHERE applicant_id = '${req.user._id}' AND job_id='${applicationData.jobId}'`)
    if (previouslyApplied[0].count > 0) throw new APIError(`User already applied for the job`, httpStatus.BAD_REQUEST)
    const jobData = await Job.findById(req.params.jobId).exec()
    if (!jobData) throw new APIError(`Invalid jobId`, httpStatus.INTERNAL_SERVER_ERROR)
    applicationData.recruiterId = jobData.recruiter
    applicationData.applicantId = req.user._id
    const application = new Application(applicationData)
    const savedApplication = await application.save()
    if (!savedApplication) throw new APIError(`Job not created`, httpStatus.INTERNAL_SERVER_ERROR)
    const applicationPointers = {
      'job_id': savedApplication.jobId,
      'applicant_id': savedApplication.applicantId,
      'recruiter_id': savedApplication.recruiterId,
      'application_id': savedApplication._id
    }
    await sql.query('INSERT INTO job_application SET ?', applicationPointers)
    await deleteIncompleteApplication(applicationPointers.applicant_id, applicationPointers.job_id)
    response.payLoad = savedApplication
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    console.log(error)
    next(error)
  }
}

exports.save = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) throw new APIError(`Invalid jobId`, httpStatus.BAD_REQUEST)
    const response = {payLoad: {}, message: ''}
    const saveJobPointers = {
      'job_id': req.params.jobId,
      'applicant_id': req.user._id
    }
    const currentValues = await sql.query(`SELECT * FROM saved_job WHERE job_id = '${saveJobPointers.job_id}' AND applicant_id = '${saveJobPointers.applicant_id}'`)
    if (currentValues.length > 0) throw new APIError(`Job already saved`, httpStatus.INTERNAL_SERVER_ERROR)
    const queryOutput = await sql.query('INSERT INTO saved_job SET ?', saveJobPointers)
    if (!queryOutput) throw new APIError(`Job not saved`, httpStatus.INTERNAL_SERVER_ERROR)
    response.message = 'SUCCESS'
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.unsave = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) throw new APIError(`Invalid jobId`, httpStatus.BAD_REQUEST)
    const response = {payLoad: {}, message: ''}
    const saveJobPointers = {
      'job_id': req.params.jobId,
      'applicant_id': req.user._id
    }
    const currentValues = await sql.query(`DELETE FROM saved_job WHERE job_id = '${saveJobPointers.job_id}' AND applicant_id = '${saveJobPointers.applicant_id}'`)
    if (currentValues.affectedRows >= 1) {
      response.message = 'SUCCESS'
    } else {
      response.message = 'FAILED'
    }
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.fetchSavedCount = async (req, res, next) => {
  try {
    const response = {payLoad: 0}
    const savedJobs = await sql.query(`SELECT * FROM saved_job WHERE applicant_id = '${req.user._id}'`)
    response.payLoad = savedJobs.length
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.getApplicationDetails = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) throw new APIError(`Invalid jobId`, httpStatus.BAD_REQUEST)
    const response = { payLoad: [] }
    const ObjectID = mongoose.Types.ObjectId
    var jobId = req.params.jobId
    var query = {
      'jobId': new ObjectID(jobId)
    }
    var applications = await Application.find(query)
    for (let index = 0; index < applications.length; index++) {
      var applicantId = applications[index]['applicantId']
      var applicant = await Applicant.findOne({id: applicantId}).exec()
      var convertedApplicationJSON = JSON.parse(JSON.stringify(applications[index]))
      convertedApplicationJSON.profile_image = applicant.profile_image
      response.payLoad.push(convertedApplicationJSON)
    }
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.fetchSaved = async (req, res, next) => {
  try {
    const response = {payLoad: []}
    const savedJobs = await sql.query(`SELECT * FROM saved_job WHERE applicant_id = '${req.user._id}'`)
    for (let index = 0; index < savedJobs.length; index++) {
      const element = savedJobs[index]
      const job = await Job.findById(element.job_id).exec()
      response.payLoad.push(job)
    }
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.fetchAppliedCount = async (req, res, next) => {
  try {
    const response = {payLoad: 0}
    const appliedJobs = await sql.query(`SELECT * FROM job_application WHERE applicant_id = '${req.user._id}'`)
    response.payLoad = appliedJobs.length
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.fetchApplied = async (req, res, next) => {
  try {
    const response = {payLoad: []}
    const appliedJobs = await sql.query(`SELECT * FROM job_application WHERE applicant_id = '${req.user._id}'`)
    for (let index = 0; index < appliedJobs.length; index++) {
      const element = appliedJobs[index]
      const job = await Job.findById(element.job_id).exec()
      response.payLoad.push(job)
    }
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    next(error)
  }
}

exports.easyApply = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.jobId)) throw new APIError(`Invalid jobId`, httpStatus.BAD_REQUEST)
    if (!req.body.phone && !req.body.email && !req.body.resume) throw new APIError(`Input data missing phone, email and resume required`, httpStatus.BAD_REQUEST)
    const response = { payLoad: {} }
    const previouslyApplied = await sql.query(`SELECT COUNT(*) as count FROM job_application WHERE applicant_id = '${req.user._id}' AND job_id='${req.params.jobId}'`)
    if (previouslyApplied[0].count > 0) throw new APIError(`User already applied for the job`, httpStatus.BAD_REQUEST)
    const user = await Applicant.findOne({id: req.user._id}).exec()
    const applicationData = {
      'name': user.name,
      'email': req.body.email,
      'phone': req.body.phone,
      'address': user.address,
      'resume': req.body.resume,
      'source': 'Linkedin',
      'diversity': 'AUTO',
      'sponsorship': 'AUTO',
      'disability': 'AUTO'
    }
    applicationData.jobId = req.params.jobId
    const jobData = await Job.findById(req.params.jobId).exec()
    if (!jobData) throw new APIError(`Invalid jobId`, httpStatus.INTERNAL_SERVER_ERROR)
    applicationData.recruiterId = jobData.recruiter
    applicationData.applicantId = req.user._id
    const application = new Application(applicationData)
    const savedApplication = await application.save()
    if (!savedApplication) throw new APIError(`Job not created`, httpStatus.INTERNAL_SERVER_ERROR)
    const applicationPointers = {
      'job_id': savedApplication.jobId,
      'applicant_id': savedApplication.applicantId,
      'recruiter_id': savedApplication.recruiterId,
      'application_id': savedApplication._id
    }
    await sql.query('INSERT INTO job_application SET ?', applicationPointers)
    await deleteIncompleteApplication(applicationPointers.applicant_id, applicationPointers.job_id)
    response.payLoad = savedApplication
    res.status(httpStatus.OK)
    res.send(response)
  } catch (error) {
    console.log(error)
    next(error)
  }
}

const deleteIncompleteApplication = async (applicantId, jobId) => {
  await sql.query(`DELETE FROM incomplete_application WHERE userId = '${applicantId}' AND jobId = '${jobId}'`)
  await sql.query(`DELETE FROM saved_job WHERE applicant_id = '${applicantId}' AND job_id = '${jobId}'`)
}
